/**
 * 获取当前位置的经纬度
 */

vds.import("vds.app.*");

function main(ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var success = function (rs) {
				if (ruleContext.setResult) {
					ruleContext.setResult({
						//纬度
						latitude: result.coords.latitude,
						//经度
						longitude: result.coords.longitude,
						isSuccess: true
					});
				}
				resolve();
			}
			var error = function (rs) {
				if (ruleContext.setResult) {
					ruleContext.setResult({
						isSuccess: false
					});
				}
			}
			var promise = vds.app.getCurrentPosition();
			promise.then(success).catch(error);
		} catch (ex) {
			reject(ex);
		}
	});
}

exports.main = main;