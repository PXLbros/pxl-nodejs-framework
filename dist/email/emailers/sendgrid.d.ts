import { MailDataRequired } from '@sendgrid/mail';
import Emailer, { EmailerProps } from '../emailer.js';
interface SendgridEmailerProps extends EmailerProps {
    apiKey: string;
}
export default class SendgridEmailer extends Emailer {
    constructor(props: SendgridEmailerProps);
    sendMail(mailOptions: MailDataRequired | MailDataRequired[]): Promise<void>;
}
export {};
//# sourceMappingURL=sendgrid.d.ts.map