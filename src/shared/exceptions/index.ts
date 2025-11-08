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
  constructor(message: string = "Unauthorized access") {
    super(message, HttpStatus.FORBIDDEN);
  }
}

/**
 * 余额不足异常
 */
export class InsufficientBalanceException extends BusinessException {
  constructor(message: string = "Insufficient service balance") {
    super(message, HttpStatus.BAD_REQUEST);
  }
}

/**
 * 时间冲突异常
 */
export class TimeConflictException extends BusinessException {
  constructor(message: string = "Timeslot already booked") {
    super(message, HttpStatus.CONFLICT);
  }
}

/**
 * 资源未找到异常
 */
export class NotFoundException extends BusinessException {
  constructor(message: string = "Resource not found") {
    super(message, HttpStatus.NOT_FOUND);
  }
}
