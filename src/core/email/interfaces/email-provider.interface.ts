import { ISendEmailParams } from './email.interface';

/**
 * Email Provider Interface
 * 
 * Abstract interface that all email providers must implement
 */
export interface IEmailProvider {
  /**
   * Send email
   * 
   * @param params - Email parameters
   */
  send(params: ISendEmailParams): Promise<void>;
}

