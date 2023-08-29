/*
 * SPDX-License-Identifier: Apache-2.0
 */
// Deterministic JSON.stringify()
import {Context, Contract, Info, Returns, Transaction} from 'fabric-contract-api';
import stringify from 'json-stringify-deterministic';
import sortKeysRecursive from 'sort-keys-recursive';
import {Account} from './account';
import userType from './constant/userType';
import { STR_NONE, BALANCE_UNCHANGE } from './constant/chaincodeConst';
const snarkjs = require('snarkjs');
import { TransactionContract } from './transactionContract';
import { ChaincodeResponse } from 'fabric-shim-api';

// const adminToken = 'WoAiNiLuWenJun';

@Info({title: 'Accounts', description: 'Smart contract for accounts of zk transaction system'})
export class AccountContract extends Contract {
    // example of how to write to world state deterministically
    // use convetion of alphabetic order
    // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
    // when retrieving data, in any lang, the order of data will be the same and consequently also the corresonding hash

    //初始化账户对象数组，数组中初始有一个测试账户写入世界状态
    @Transaction()
    public async InitLedger(ctx: Context): Promise<void> {
        const accounts: Account[] = [
            {
                id:0,
                publicKey:'123124',
                pemCert:'',
                balance:124923123,
                type:2,
                alive:1,
            }
        ];

        await ctx.stub.putState(`${accounts[0].id}`, Buffer.from(stringify(sortKeysRecursive(accounts[0]))));
        console.info(`Account ${accounts[0].id} initialized`);
    }

    // 创建账户的方法
    @Transaction()
    public async CreateAccount(
        ctx: Context, 
        id: number, 
        publicKey:string, 
        type: number, 
        pemCert:string, 
    ): Promise<void> {
        const exists = await this.AccountExists(ctx, id);
        if (exists) {
            throw new Error(`The account ${id} already exists`);
        }

        //组装创建的账户对象
        const account:Account = {
            id,
            publicKey,
            pemCert:'',
            type,
            balance: 0,
            alive:1,
        };

        //如果是金融组织注册，那么一定要有pem证书，否则报错
        if(type === userType.ORGANIZATION && (!pemCert || pemCert === '')){
            throw new Error('Invalid Organization register! pemCert is required.'); 
        }
        else if(type !== userType.ORGANIZATION && (pemCert && pemCert !== '')){
            throw new Error('Invalid Organization register! redundant pemCert detected.'); 
        }else{
            account.pemCert = pemCert;
        }
        
        //管理员身份的注册需要额外提供一个token，这个token必须和上面那个adminToken完全一样！实际系统运行时不会有管理员账号！
        // if(type === userType.ADMIN){
        //     if(token !== adminToken){
        //         throw new Error('Invalid Admin register! adminToken is not correct.');
        //     }
        // }

        // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
        await ctx.stub.putState(`${id}`, Buffer.from(stringify(sortKeysRecursive(account))));
    }

    // 查询账户的方法，根据给出的id查询指定id的链上账户信息
    @Transaction(false)
    public async ReadAccount(ctx: Context, id: number): Promise<string> {
        const accountJSON = await ctx.stub.getState(`${id}`); // get the asset from chaincode state
        if (!accountJSON || accountJSON.length === 0) {
            throw new Error(`The account ${id} does not exist`);
        }
        return accountJSON.toString();
    }

    @Transaction(false)
    public async ReadAllAccounts(ctx: Context):Promise<string> {
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

    // UpdateAsset updates an existing asset in the world state with provided parameters.
    @Transaction()
    public async UpdateAccount(
        ctx: Context, 
        id: number, 
        balanceChange: number, 
        publicKeyChange: string,
        aliveChange: number, 
        pemCertChange: string,
    ): Promise<void> {
        const accountJsonStr = await this.ReadAccount(ctx,id);//账号不存在的逻辑在ReadAccount方法中已经有写处理了
        const account:Account = JSON.parse(accountJsonStr);
        
        // overwriting original asset with new asset
        const updatedAccount:Account = {
            id,
            //publicKey即使不变也要传入'none'！这是由于后端通过gateway调用链码时参数必须要以string数组形式给入造成的，其中undefined不可以作为元素
            publicKey:publicKeyChange === STR_NONE? account.publicKey : publicKeyChange,
            pemCert:account.pemCert,
            type:account.type,
            //由于账户余额不可能是负值，故此处用-1表示账户余额不变
            balance: balanceChange === BALANCE_UNCHANGE? account.balance : balanceChange,
            //aliveChange只会在注销账号时变成0,因此每次更新账号aliveChange都是1,只有注销时输入0
            alive: aliveChange,
        };

        //若当前待更新的账户为金融组织账户，并且要更新其pem证书（这说明组织可能已经更新通道配置，并重新加入了通道）
        if(account.type === userType.ORGANIZATION && pemCertChange !== STR_NONE){
            updatedAccount.pemCert = pemCertChange;
        }
        //若当前待更新的账户非金融组织账户，但要更新其pem证书，报错
        if(account.type !== userType.ORGANIZATION && pemCertChange !== STR_NONE){
            throw new Error('Invalid Account Update, pemCert update reject.');
        }
        //若当前待更新的账户为金融组织账户，但要却没有提供其pem证书，报错
        if(account.type === userType.ORGANIZATION && pemCertChange === STR_NONE){
            throw new Error('Invalid Account Update, pemCert is empty.');
        }

        return ctx.stub.putState(`${id}`, Buffer.from(stringify(sortKeysRecursive(updatedAccount))));
    }

    @Transaction()
    private async BatchUpdateBalance(ctx: Context, ids:number[], finalBalances: number[]): Promise<boolean>{
        for(let i = 0;i < ids.length && ids[i] !== 0; i++){
            const accountJson = await this.ReadAccount(ctx,ids[i]);
            const account = JSON.parse(accountJson);

            account.balance = finalBalances[i];

            ctx.stub.putState(`${ids[i]}`,Buffer.from(stringify(sortKeysRecursive(account))));
        }

        return true;
    }

    // 系统不会真正删除一个账户，保证索引查找的速度--空间换时间
    @Transaction()
    public async DeleteAccount(ctx: Context, id: number): Promise<void> {
        const exist = this.AccountExists(ctx,id);
        if(!exist) throw new Error('Invalid Account Delete, Account does not Exist!');

        //如果是组织账号注销，置其pem证书也为空串
        return await this.UpdateAccount(ctx,id,0,'',0,'');
    }

    // 判断账户是否存在
    @Transaction(false)
    @Returns('boolean')
    public async AccountExists(ctx: Context, id: number): Promise<boolean> {
        const accountJSON = await ctx.stub.getState(`${id}`);
        return accountJSON && accountJSON.length > 0;
    }


//#############################################################交易相关的方法#############################################################

    @Transaction()
    public async zkVerifier(ctx: Context, zkProofStr:string): Promise<string> {
        const zkProof = JSON.parse(zkProofStr);
        const { ids, finalBalances, vkey, publicSignals,proof } = zkProof;

        const isValid = snarkjs.plonk.verify(vkey,publicSignals,proof);

        if(!isValid) return null;
        
        const res = await this.BatchUpdateBalance(ctx,ids,finalBalances);

        const mspId = ctx.stub.getMspID();
        const createTime = ctx.stub.getDateTimestamp();
        const transactionId = ctx.stub.getTxID(); 
        const channelId = ctx.stub.getChannelID();       

        let result:ChaincodeResponse;
        if(res){
            const result = await ctx.stub.invokeChaincode('TransactionContract',[
                transactionId,
                mspId,
                channelId,
                createTime,
                ids,
                finalBalances,
            ],channelId);
        }

        return JSON.stringify(result);
    }

    // GetAllAssets returns all assets found in the world state.
    @Transaction(false)
    @Returns('string')
    public async GetAllAssets(ctx: Context): Promise<string> {
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
