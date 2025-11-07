import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * 业务异常基类
 */
export class BusinessException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(message, statusCode);
  }
}

/**
 * 未授权异常
 */
export class UnauthorizedException extends BusinessException {
  constructor(message: string = "未授权访问") {
    super(message, HttpStatus.FORBIDDEN);
  }
}

/**
 * 余额不足异常
 */
export class InsufficientBalanceException extends BusinessException {
  constructor(message: string = "服务余额不足") {
    super(message, HttpStatus.BAD_REQUEST);
  }
}

/**
 * 时间冲突异常
 */
export class TimeConflictException extends BusinessException {
  constructor(message: string = "时间段已被占用") {
    super(message, HttpStatus.CONFLICT);
  }
}

/**
 * 资源未找到异常
 */
export class NotFoundException extends BusinessException {
  constructor(message: string = "资源未找到") {
    super(message, HttpStatus.NOT_FOUND);
  }
}
