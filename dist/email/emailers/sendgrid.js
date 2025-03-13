import sgMail from '@sendgrid/mail';
import Emailer from '../emailer.js';
export default class SendgridEmailer extends Emailer {
    constructor(props) {
        super(props);
        sgMail.setApiKey(props.apiKey);
    }
    async sendMail(mailOptions) {
        await sgMail.send(mailOptions);
    }
}
//# sourceMappingURL=sendgrid.js.map