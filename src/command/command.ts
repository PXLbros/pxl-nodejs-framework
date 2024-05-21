export default abstract class Command {
  public abstract execute(): Promise<void>;
}
