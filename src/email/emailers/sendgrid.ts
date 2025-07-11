import sgMail, { type MailDataRequired } from '@sendgrid/mail';
import Emailer, { type EmailerProps } from '../emailer.js';

interface SendgridEmailerProps extends EmailerProps {
  apiKey: string;
}

export default class SendgridEmailer extends Emailer {
  constructor(props: SendgridEmailerProps) {
    super(props);

    sgMail.setApiKey(props.apiKey);
  }

  async sendMail(mailOptions: MailDataRequired | MailDataRequired[]) {
    await sgMail.send(mailOptions);
  }
}
