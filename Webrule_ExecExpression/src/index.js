/**
 * 执行函数/表达式
 */
vds.import("vds.expression.*");

var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var input = ruleContext.getVplatformInput();
			var expression = input["expression"]; // 函数/表达式
			var retValue = vds.expression.execute(expression, { "ruleContext": ruleContext });
			ruleContext.setResult("retValue", retValue + "");
			resolve();
		} catch (e) {
			reject(e);
		}
	});
};

export { main }