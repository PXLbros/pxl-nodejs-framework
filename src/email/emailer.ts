export interface EmailerProps {}

export default abstract class Emailer {
  constructor(protected props: EmailerProps) {}

  abstract sendMail(mailOptions: any): Promise<void>;
}
