/**
 * 打印及预览操件
 * {
 *	"componentControls": [
 *      {
 *          "componentControlID": "0e2d1c8b14e74c40986153e4f560b6bc",
 *          "componentControlCode": "JGFormatTextDisplay2"
 *      },
 *      {
 *          "componentControlID": "9915792d84cf461bac7d95ff13c4e26a",
 *         "componentControlCode": "JGFormatTextDisplay3"
 *      }
 *  ],
 *	"type" : "1" //操作类型，1为打印预览，2为打印
 * }
 */


	var jsonUtil;
	var widgetContext;
	exports.initModule = function(sBox){
		 jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
//		 viewContext = require('system/view/viewContext');
		 widgetContext = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.context.WidgetContext");
	}
	// 操作类型：0为打印预览，1为打印
	var OP_PRINT_PREVIEW = '0', OP_PRINT = '1';

	function main(ruleContext) {
		var ruleConfig = ruleContext.getRuleCfg();
		var inParams = ruleConfig.inParams;
		var inParamObj = jsonUtil.json2obj(inParams);

		// 控件数组
		var controlIDs = inParamObj.componentControls;
		
		//没有要打印的控件，直接返回
		if(!controlIDs) return;
		
		// 操作类型
		var type = inParamObj['type'];
		
		var controls = [];
		for (var i = 0; i < controlIDs.length; i++) {
			var controlID = controlIDs[i].componentControlCode;
			var control = widgetContext.get(controlID, "widgetObj");
//			var control = viewContext.getRuntimeWidgetObjFromContext(controlID);
			if(control){
				controls.push(control);
			}
		}
		
		//没有要打印的控件，直接返回
		if(controls.length <= 0) return;

		switch (type) {
			case OP_PRINT_PREVIEW :
				controls[0].controlPrintPreview(controls);
				break;
			case OP_PRINT :
				controls[0].controlPrint(controls);
				break;
			default :
				break;
		}
	}

	exports.main = main;

export{    main}