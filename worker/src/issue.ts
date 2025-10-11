export abstract class Issue {
  public uniqueId(): string {
    return `${this.provider()}-${this.id()}`;
  }

  abstract provider(): string
  abstract id(): string;
  abstract updatedAt(): Date;
  abstract title(): string;
}
