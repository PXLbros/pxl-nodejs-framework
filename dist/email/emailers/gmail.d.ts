import Emailer, { EmailerProps } from '../emailer.js';
interface GmailEmailerProps extends EmailerProps {
    user: string;
    password: string;
}
export default class GmailEmailer extends Emailer {
    private transporter;
    constructor(props: GmailEmailerProps);
    sendMail(mailOptions: {
        from: string;
        to: string;
        subject: string;
        text: string;
    }): Promise<void>;
}
export {};
//# sourceMappingURL=gmail.d.ts.map