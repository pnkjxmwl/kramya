import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { AccountActionPurpose } from '@opd/contracts';
/** Provider boundary. Live delivery stays off until the operator chooses a sender.
 * Tests replace it with an in-memory sender; no token is logged or returned.
 */
@Injectable()
export class AccountMailer {
  get configured(): boolean { return false; }

  async send(_email: string, _purpose: AccountActionPurpose, _token: string): Promise<void> {
    throw new ServiceUnavailableException('Automatic email delivery is not enabled. Contact pankajsemwal.careers@gmail.com.');
  }
}
