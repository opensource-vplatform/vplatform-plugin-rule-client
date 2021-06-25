/**
 *  当指定字段满足某条件时控制其他控件的只读、使能、显示
 *	适用场景：组件加载时，无数据时允许某些控件使用或不使用，或某个值改变后允许某些控件使用或不使用。
 *	适用事件：值改变,按钮事件，组件加载
 *	功能描述：控制指定控件是否是可用状态
 */
vds.import("vds.widget.*");
var CONTROLTYPE_READONLY = "1"; //控制类型：只读
var CONTROLTYPE_ENABLE = "2"; //控制类型：使能
var CONTROLTYPE_VISIBLE = "3"; //控制类型：显示
/**
 * 规则入口
 */
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParamsObj = ruleContext.getVplatformInput();
			var mapping = inParamsObj["mapping"]; // 控件数组
			var type = inParamsObj["type"]; // 控制类型：1为只读，2为使能，3为显示
			var func = funcFactory(type);
			if (mapping != null && mapping.length > 0) {
				for (var i = 0; i < mapping.length; i++) {
					var widgetId = mapping[i]["componentControlCode"];
					var control = mapping[i]["control"];
					func(widgetId, control);
				}
			}
			resolve();
		} catch (err) {
			reject(err);
		}
	});
}

/**
 *	方法工厂
 *	@param type 根据控制类型获取对应方法
 */
var funcFactory = function (type) {
	switch (type) {
		case CONTROLTYPE_READONLY:
			return setReadonlyOrWrite;
		case CONTROLTYPE_ENABLE:
			return setDisableOrEnable;
		case CONTROLTYPE_VISIBLE:
			return setShowOrHide;
		default:
			return setDisableOrEnable;
	}
};

/**
 *	设置控件的只读或可写
 *	@param	destWidgetId 控件id
 *  @param  readonly 是否只读
 */
var setReadonlyOrWrite = function (destWidgetId, readonly) {
	var isReadOnly = (readonly == true || readonly.toLowerCase() == "true");
	vds.widget.setProperty(destWidgetId, "ReadOnly", isReadOnly);
};

/**
 *	设置控件的使能或失效
 *	@param	destWidgetId 控件id
 *  @param  enable 是否使能
 */
var setDisableOrEnable = function (destWidgetId, enable) {
	var isEnable = (enable == true || enable.toLowerCase() == "true");
	vds.widget.setProperty(destWidgetId, "Enabled", isEnable);
};

/**
 *	设置控件的显示或隐藏
 *	@param	destWidgetId 控件id
 *  @param  show 是否显示
 */
var setShowOrHide = function (destWidgetId, show) {
	var isShow = (show == true || show.toLowerCase() == "true");
	vds.widget.setProperty(destWidgetId, "Visible", isShow);
};

export {
	main
}