/**
 * 清除界面实体中的数据
 */

vds.import("vds.ds.*", "vds.exception.*");

var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParamsObj = ruleContext.getVplatformInput();
			if (null != inParamsObj) {
				var dataSourceNames = inParamsObj["dataSourceNames"];
				if (dataSourceNames) {
					for (var i = 0; i < dataSourceNames.length; i++) {
						var datasource = vds.ds.lookup(dataSourceNames[i]["name"]);
						//如果数据源存在，则执行清除
						if (datasource) {
							datasource.clear();
						} else {
							HandleException("实体[" + dataSourceNames[i]["name"] + "]不存在！");
						}
					}
				}
			}
			resolve();
		} catch (ex) {
			reject(ex);
		}
	});
};

/**
* desc 非回调中抛异常
* @error_msg 提示信息
* */
function HandleException(error_msg) {
	var exception = vds.exception.newBusinessException(error_msg);
	throw exception;
}

exports.main = main;

export { main }