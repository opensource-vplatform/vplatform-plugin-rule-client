/**
 *获取当前App版本号
 *
 */

vds.import("vds.app.*");

//规则主入口(必须有)
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var callback = function (version) {
				setBusinessRuleResult(ruleContext, version);
				resolve();
			};
			var promise = vds.app.getVersion(callback);
			promise.then(callback).catch(reject);
		} catch (ex) {
			reject(ex);
		}
	});
};

function setBusinessRuleResult(ruleContext, result) {
	if (ruleContext.setResult) {
		ruleContext.setResult({
			// 最新的App版本号
			version: result
		});
	}
}
//注册规则主入口方法(必须有)
exports.main = main;

export { main }