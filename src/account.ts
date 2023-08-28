/*
  SPDX-License-Identifier: Apache-2.0
*/

import {Object, Property} from 'fabric-contract-api';

// @Object()
// export class Asset {
//     @Property()
//     public docType?: string;

//     @Property()
//     public ID: string;

//     @Property()
//     public Color: string;

//     @Property()
//     public Size: number;

//     @Property()
//     public Owner: string;

//     @Property()
//     public AppraisedValue: number;
// }
//以上是fabric的示例代码

//下面是本系统的代码，以下定义了账户类
@Object()
export class Account {
	@Property()
    public id:number;

	//不论是普通用户还是企业用户，都应该有ed25519公司要对，这是为了保证交易验证的同质化需求
    @Property()
    public publicKey:string;

    //对于金融组织账号，应该额外提供pem签名，因为企业账号需要拥有单独的节点必然拥有节点的X.509证书！
	//由于fabric组织节点的加入需要直接在fabric运行的系统上通过cli或者操作文件系统添加并声称X.509证书
    @Property()
    public pemCert:string;

	//余额
    @Property()
    public balance:number;

	//账户类型标识：0表示普通用户 1表示金融组织用户 2表示管理员用户
    @Property()
    public type:number;

    //这个字段一旦加上，就表示链上可能会有一些已经注销的账户，它们的alive将为false
    //这是一种典型的空间换时间的方式，这样一来链上甚至不用couchDB，而是简单数组就可以完成快速查询！数组索引就是索引！id也可以直接和数组索引相关联
    @Property()
    public alive:number;
}