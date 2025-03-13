export interface EmailerProps {
}
export default abstract class Emailer {
    protected props: EmailerProps;
    constructor(props: EmailerProps);
    abstract sendMail(mailOptions: any): Promise<void>;
}
//# sourceMappingURL=emailer.d.ts.map