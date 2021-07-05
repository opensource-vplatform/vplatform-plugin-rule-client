/**
 * 打印及预览操件
 * {
 *	"componentControls": [
 *      {
 *          "componentControlCode": "JGFormatTextDisplay2"
 *      },
 *      {
 *         "componentControlCode": "JGFormatTextDisplay3"
 *      }
 *  ],
 *	"type" : "1" //操作类型，0为打印预览，1为打印
 * }
 */
//vds.import("vds.");
/**
 * 规则入口
 */
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParamObj = ruleContext.getVplatformInput();
			if (!inParamObj) { //建议兼容
				inParamObj = "";
			}
			// 控件数组
			var controlIDs = inParamObj.componentControls;

			//没有要打印的控件，直接返回
			if (!controlIDs) {
				resolve();
				return;
			}

			// 操作类型
			var type = inParamObj['type'];

			var controls = [];
			var widgetCode;
			for (var i = 0; i < controlIDs.length; i++) {
				var controlID = controlIDs[i].componentControlCode;
				var control = vds.widget.getProperty(controlID, "widgetObj");
				if (control) {
					if (!widgetCode) {
						widgetCode = controlID;
					}
					controls.push(control);
				}
			}

			//没有要打印的控件，直接返回
			if (controls.length <= 0) {
				resolve();
				return;
			}

			switch (type) {
				case "0":
					vds.widget.execute(widgetCode, "controlPrintPreview", [controls]);
					// controls[0].controlPrintPreview(controls);
					break;
				case "1":
					vds.widget.execute(widgetCode, "controlPrint", [controls]);
					// controls[0].controlPrint(controls);
					break;
				default:
					break;
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