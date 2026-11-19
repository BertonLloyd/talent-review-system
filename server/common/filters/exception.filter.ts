import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { BusinessException } from '../interfaces/exception.interface';
import { HTTP_STATUS_TO_RESPONSE_CODE_MAP, ResponseCode } from '../constants/api_response_code';
import { ApiErrorResponse } from '../interfaces/api_response.interface';

function extractPostgresErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
    const { code, cause } = current as { code?: unknown; cause?: unknown };
    if (typeof code === 'string') return code;
    current = cause;
  }
  return undefined;
}

const PG_ERROR_TO_HTTP: Record<string, { status: HttpStatus; code: ResponseCode; message: string }> = {
  '22P02': { status: HttpStatus.BAD_REQUEST, code: ResponseCode.BAD_REQUEST, message: '参数格式错误' },
  '23502': { status: HttpStatus.BAD_REQUEST, code: ResponseCode.BAD_REQUEST, message: '必填字段缺失' },
  '23503': { status: HttpStatus.BAD_REQUEST, code: ResponseCode.BAD_REQUEST, message: '关联数据不存在' },
  '23505': { status: HttpStatus.CONFLICT, code: ResponseCode.CONFLICT, message: '数据已存在' },
  '22001': { status: HttpStatus.BAD_REQUEST, code: ResponseCode.BAD_REQUEST, message: '内容超出长度限制' },
  '42501': { status: HttpStatus.FORBIDDEN, code: ResponseCode.FORBIDDEN, message: '无操作权限' },
};

const VALIDATION_ERROR_TRANSLATIONS: Array<{ pattern: RegExp; replace: (...args: string[]) => string }> = [
  { pattern: /^(\S+)\s+should not be empty$/, replace: (f) => `${f} 不能为空` },
  { pattern: /^(\S+)\s+must be a number conforming to the specified constraints$/, replace: (f) => `${f} 必须是有效数字` },
  { pattern: /^(\S+)\s+must be an integer number$/, replace: (f) => `${f} 必须是整数` },
  { pattern: /^(\S+)\s+must be a string$/, replace: (f) => `${f} 必须是字符串` },
  { pattern: /^(\S+)\s+must be a boolean$/, replace: (f) => `${f} 必须是布尔值` },
  { pattern: /^(\S+)\s+must be an array$/, replace: (f) => `${f} 必须是数组` },
  { pattern: /^(\S+)\s+must be shorter than or equal to (\d+) characters$/, replace: (f, n) => `${f} 长度不能超过 ${n} 个字符` },
  { pattern: /^(\S+)\s+must be longer than or equal to (\d+) characters$/, replace: (f, n) => `${f} 长度不能少于 ${n} 个字符` },
  { pattern: /^(\S+)\s+each value in (?:the )?nested property must be either object or array$/, replace: (f) => `${f} 格式不正确` },
  { pattern: /^(\S+)\s+nested property (.*) must be either object or array$/, replace: (f) => `${f} 格式不正确` },
];

function translateValidationMessage(msg: string): string {
  for (const { pattern, replace } of VALIDATION_ERROR_TRANSLATIONS) {
    const match = msg.match(pattern);
    if (match) {
      return replace(match[1], match[2]);
    }
  }
  return msg;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (response.headersSent) {
      return;
    }

    let errorResponse: Omit<ApiErrorResponse, 'httpStatus'>;
    let httpStatus: HttpStatus;

    if (exception instanceof BusinessException) {
      httpStatus = exception.httpStatus;
      errorResponse = {
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
          fieldErrors: exception.fieldErrors,
          timestamp: Date.now(),
        },
      };
    } else if (exception instanceof HttpException) {
      httpStatus = exception.getStatus() as HttpStatus;
      const exceptionResponse = exception.getResponse();
      let message: string = exception.message;
      let fieldErrors: Record<string, string[]> | undefined;

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as { message?: string | string[]; error?: string };
        if (Array.isArray(resp.message) && resp.message.length > 0) {
          message = translateValidationMessage(resp.message[0]);
        } else if (typeof resp.message === 'string' && resp.message) {
          message = resp.message;
        }

        if (httpStatus === HttpStatus.BAD_REQUEST && Array.isArray(resp.message)) {
          const grouped: Record<string, string[]> = {};
          for (const msg of resp.message) {
            if (typeof msg === 'string') {
              const translated = translateValidationMessage(msg);
              const match = translated.match(/^([\w.]+)\s+(.+)$/);
              if (match) {
                const field = match[1];
                const errMsg = match[2];
                if (!grouped[field]) grouped[field] = [];
                grouped[field].push(errMsg);
              } else {
                if (!grouped['_global']) grouped['_global'] = [];
                grouped['_global'].push(translated);
              }
            }
          }
          if (Object.keys(grouped).length > 0) fieldErrors = grouped;
        }
      }

      errorResponse = {
        error: {
          code: HTTP_STATUS_TO_RESPONSE_CODE_MAP[httpStatus],
          message,
          fieldErrors,
          details: typeof exceptionResponse === 'object' ? JSON.stringify(exceptionResponse) : undefined,
          timestamp: Date.now(),
        },
      };
    } else {
      const pgCode = extractPostgresErrorCode(exception);
      const pgMapping = pgCode ? PG_ERROR_TO_HTTP[pgCode] : undefined;
      if (pgMapping) {
        httpStatus = pgMapping.status;
        errorResponse = {
          error: {
            code: pgMapping.code,
            message: pgMapping.message,
            timestamp: Date.now(),
          },
        };
      } else {
        httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
        errorResponse = {
          error: {
            code: ResponseCode.INTERNAL_ERROR,
            message: '服务器内部错误',
            stack: (exception as Error).stack,
            cause: (exception as Error).cause as string,
            timestamp: Date.now(),
          },
        };
      }
    }

    response.status(httpStatus).json(errorResponse);
  }
}
