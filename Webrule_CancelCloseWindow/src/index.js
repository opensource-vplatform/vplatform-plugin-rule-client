/**
 *取消关闭窗体
 *
 */

vds.import("vds.window.*");

//规则主入口(必须有)
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			vds.window.cancelClose();
			resolve();
		} catch (ex) {
			reject(ex);
		}
	});
};

export { main }