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
		// 最新的App版本号
		ruleContext.setResult("version", result);
	}
}

export { main }