import { Module } from "@nestjs/common";
import { UserModule } from "@domains/identity/user/user.module";
import { AuthCommandService } from "./auth-command.service";

@Module({
  imports: [UserModule],
  providers: [AuthCommandService],
  exports: [AuthCommandService],
})
export class AuthCommandModule {}
