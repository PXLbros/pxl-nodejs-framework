import nodemailer from 'nodemailer';
import Emailer, { type EmailerProps } from '../emailer.js';

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
  private transporter: any;

  constructor(props: SmtpEmailerProps) {
    super(props);

    this.transporter = nodemailer.createTransport(props.smtpConfig);
  }

  async sendMail(mailOptions: any) {
    await this.transporter.sendMail(mailOptions);
  }
}
