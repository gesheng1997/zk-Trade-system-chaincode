import { Property, Object } from "fabric-contract-api";

@Object()
export class BatchTransRecord {
    @Property()
    public transactionId: string;

    @Property()
    public mspId: string;

    @Property()
    public channelId: string;

    @Property()
    public createTime: Date;

    @Property()
    public snapshotIds: number[];

    @Property()
    public snapshotBalances: number[];
}