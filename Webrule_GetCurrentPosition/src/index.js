/**
 * 获取当前位置的经纬度
 */

vds.import("vds.app.*");

var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var success = function (result) {
				if (ruleContext.setResult) {
					//纬度
					ruleContext.setResult("latitude", result.coords.latitude);
					//经度
					ruleContext.setResult("longitude", result.coords.longitude);
					ruleContext.setResult("isSuccess", true);
				}
				resolve();
			}
			var error = function (result) {
				if (ruleContext.setResult) {
					ruleContext.setResult("isSuccess", false);
				}
				resolve();
			}
			var promise = vds.app.getCurrentPosition();
			promise.then(success).catch(error);
		} catch (ex) {
			reject(ex);
		}
	});
}

exports.main = main;