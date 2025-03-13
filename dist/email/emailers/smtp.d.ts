import Emailer, { EmailerProps } from '../emailer.js';
interface SmtpEmailerProps extends EmailerProps {
    smtpConfig: {
        host: string;
        port: number;
        secure: boolean;
        auth: {
            user: string;
            pass: string;
        };
    };
}
export default class SmtpEmailer extends Emailer {
    private transporter;
    constructor(props: SmtpEmailerProps);
    sendMail(mailOptions: any): Promise<void>;
}
export {};
//# sourceMappingURL=smtp.d.ts.map