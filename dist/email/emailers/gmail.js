import Emailer from '../emailer.js';
import nodemailer from 'nodemailer';
export default class GmailEmailer extends Emailer {
    transporter;
    constructor(props) {
        super(props);
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: props.user,
                pass: props.password,
            },
        });
    }
    async sendMail(mailOptions) {
        // Send the email
        this.transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log("Error:", error);
            }
            else {
                console.log("Email sent: " + info.response);
            }
        });
    }
}
//# sourceMappingURL=gmail.js.map