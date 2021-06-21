/**
 * 退出业务组件(本业务规则主要用户弹出选择类操作，选择确定时会返回确认信息，并将组件的输出返回给上级组件。)
 */

	var dispose ;
	exports.initModule = function(sBox) {
		dispose = sBox.getService("vjs.framework.extension.platform.services.view.window.dispose.Mode");
	}

	var main = function(ruleContext) {
		dispose.dispose(ruleContext);
	};
	
	exports.main = main;

export{    main}