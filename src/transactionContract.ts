import {Context, Contract, Info, Returns, Transaction} from 'fabric-contract-api';
import stringify from 'json-stringify-deterministic';
import sortKeysRecursive from 'sort-keys-recursive';
import { BatchTransRecord } from './transaction';
import { AccountContract } from './accountContract';

@Info({title: 'TransactionContract', description: 'Smart contract for transactions of zk transaction system'})
export class TransactionContract extends Contract {
    // TransferAsset updates the owner field of asset with given id in the world state, and returns the old owner.
    @Transaction()
    public async addTransaction(
        ctx: Context, 
        transactionId: string,
        mspId: string,
        channelId: string,
        createTime: Date,
        snapshotIds: number[],
        snapshotBalances: number[], 
    ): Promise<BatchTransRecord> {
        const record = {
            transactionId,
            mspId,
            channelId,
            createTime,
            snapshotIds,
            snapshotBalances,
        }
        await ctx.stub.putState(transactionId, Buffer.from(stringify(sortKeysRecursive(record))));
        return record;
    }

    @Transaction(false)
    public async findTransaction(ctx: Context, transactionId: string): Promise<BatchTransRecord>{
        const record = await ctx.stub.getState(transactionId);
        return JSON.parse(record.toString());
    }

    @Transaction(false)
    public async findAllTransactions(ctx: Context){
        const allResults = [];
        // range query with empty string for startKey and endKey does an open-ended query of all assets in the chaincode namespace.
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
            allResults.push(record);
            result = await iterator.next();
        }
        return JSON.stringify(allResults);
    }
}