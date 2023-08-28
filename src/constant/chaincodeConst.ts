//表示账户余额不更新的情况，账户余额不可能为负
export const BALANCE_UNCHANGE = -1;

//这个专门用于表示publicKey和pemert不更新的情况
//因为存在注销时要置他们二者为空的情况，故不可以使用''代表不更新
//而'none'既不是ed25519公钥的格式，也不是pem格式，且语义明确，非常适合这个工作
export const STR_NONE = 'none';