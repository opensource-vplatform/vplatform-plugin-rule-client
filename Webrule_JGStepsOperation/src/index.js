/**
 * 步骤条操作
 */
 vds.import("vds.widget.*","vds.expression.*");
/**
 * 规则入口
 */
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParamsObj = ruleContext.getVplatformInput();
			if (!inParamsObj) {//建议兼容
				inParamsObj = "";
			}
			var widgetCode = inParamsObj.widgetCode;
			var widget = vds.widget.getProperty(widgetCode, "widgetObj");
			var operations = inParamsObj.operations;
			if (operations && operations.length > 0) {
				for (var i = 0; i < operations.length; i++) {
					switch (operations[i].type) {
						case "setStatus":
							setStatus(operations[i], widget);
							break;
						case "nextStep":
							brotherStep(operations[i], widget, 'next');
							break;
						case "previousStep":
							brotherStep(operations[i], widget, 'previous');
							break;
						case "specifyStep":
							specifyStep(operations[i], widget, ruleContext);
							break;
					}
				}
			}
			resolve();
		} catch (err) {
			reject(err);
		}
	});
}
// var CurrentRecordObserver,
// 	observerManager;

// exports.initModule = function (sBox) {
// 	CurrentRecordObserver = sBox.getService("vjs.framework.extension.platform.interface.observer.CurrentRecordObserver");
// 	observerManager = sBox.getService("vjs.framework.extension.platform.services.observer.manager.DatasourceObserverManager");
// }
var setStatus = function (operation, widget) {
	executeWidgetAction(widget.Code, "setStepStatus", operation.value);
}

var brotherStep = function (operation, widget, type) {
	executeWidgetAction(widget.Code, "setBrotherStep", type);
}

var specifyStep = function (operation, widget, ruleContext) {
	var currentId = analysizeOperationValue(operation, widget, ruleContext);
	executeWidgetAction(widget.Code, "setCurrentRecord", currentId);
}

var executeWidgetAction = function (widgetId, eventName, args) {
	vds.widget.execute(widgetId, eventName, [args]);
}
var analysizeOperationValue = function (operation, widget, ruleContext) {
	var value = "";
	if (operation.valueType == "expression") {
		if (operation.value.indexOf('[') == 0) {
			var entityName = operation.value.split('.')[0].slice(1, operation.value.split('.')[0].length - 1);
			var fieldName = operation.value.split('.')[1].slice(1, operation.value.split('.')[1].length - 1);
			if (entityName) {
				var _this = this;
				if (!widget.hasObserver) {
					var observer = new CurrentRecordObserver(entityName, '', {}, [fieldName]);//？？？
					observer.setWidgetValueHandler(function (record) {
						widget.hasObserver = true;
						specifyStep(operation, widget)
					})
					observer.clearWidgetValueHandler(function (record) {
						widget.hasObserver = true;
						specifyStep(operation, widget)
					})
					observerManager.addObserver({
						observer: observer
					});
				}
			}
		}
		value = vds.expression.execute(operation.value, {
			"ruleContext": ruleContext
		});
	} else {
		value = operation.value;
	}
	return value;
}

export {
	main
}