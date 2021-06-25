/**
 * weicd 2011-11-26
 * 清空选定控件的显示数据
 * 适用场景：在某些操作前需要清空原来的数据，使其处于初始状态
 * 适用事件：所有事件
 * 功能描述： 清空指定控件的数据
 */
vds.import("vds.widget.*","vds.exception.*");
/**
 * 规则入口
 */
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParamsObj = ruleContext.getVplatformInput();
			var retSetItems = inParamsObj["componentControlCodes"];
			if (!retSetItems || retSetItems.length < 1) return;
			for (var index = 0; index < retSetItems.length; index++) {
				var widgetID = retSetItems[index]["componentControlCode"];

				if (!widgetID) {
					continue;
				}

				if (!vds.widget.exists(widgetID)) {
					reject(vds.exception.newConfigException("控件【"+widgetID+"】不存在，请检查配置."));
					return;
				}
				vds.widget.execute(widgetID, "cleanSelectedControlValue");
				// if (widgetAction.isWidgetActionExist(widgetID, "cleanSelectedControlValue"))
				// else{
				// 	reject(vds.exception.newConfigException("控件【"+widgetID+"】不支持清空控件数值"));
				// }

			}
			resolve();
		} catch (err) {
			reject(err);
		}
	});
}
export {
	main
}