import nodemailer from 'nodemailer';
import Emailer from '../emailer.js';
export default class SmtpEmailer extends Emailer {
    transporter;
    constructor(props) {
        super(props);
        this.transporter = nodemailer.createTransport(props.smtpConfig);
    }
    async sendMail(mailOptions) {
        await this.transporter.sendMail(mailOptions);
    }
}
//# sourceMappingURL=smtp.js.map