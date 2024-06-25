export default abstract class Command {
  /** Command name */
  public abstract name: string;

  /** Command description */
  public abstract description: string;

  /** Run command **/
  public abstract run(): Promise<void>;
}
