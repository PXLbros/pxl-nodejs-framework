import SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import Emailer, { EmailerProps } from '../emailer.js';
import nodemailer from 'nodemailer';

interface GmailEmailerProps extends EmailerProps {
  user: string;
  password: string;
}

export default class GmailEmailer extends Emailer {
  private transporter: any;

  constructor(props: GmailEmailerProps) {
    super(props);

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: props.user,
        pass: props.password,
      },
    });
  }

  async sendMail(mailOptions: {
    from: string;
    to: string;
    subject: string;
    text: string;
  }) {
    // Send the email
    this.transporter.sendMail(mailOptions, (error: any, info: any) => {
      if (error) {
        console.log('Error:', error);
      } else {
        console.log(`Email sent: ${info.response}`);
      }
    });
  }
}
