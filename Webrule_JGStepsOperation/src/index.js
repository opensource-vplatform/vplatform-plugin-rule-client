/**
 * 步骤条操作
 */

	var jsonUtil,
		widgetContext,
		formulaEngine,
		ExpressionContext,
		CurrentRecordObserver,
		observerManager,
		ScopeManager,
		actionHandler,
		sb;

	exports.initModule = function(sBox) {
		sb = sBox;
		jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
		widgetContext = sb.getService("vjs.framework.extension.platform.services.view.widget.common.context.WidgetContext");
		formulaEngine = sb.getService("vjs.framework.extension.platform.engine.expression.ExpressionEngine");
		ExpressionContext = sb.getService("vjs.framework.extension.platform.engine.expression.ExpressionContext");
		CurrentRecordObserver = sb.getService("vjs.framework.extension.platform.interface.observer.CurrentRecordObserver");
		observerManager = sb.getService("vjs.framework.extension.platform.services.observer.manager.DatasourceObserverManager");
		ScopeManager = sb.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
		actionHandler = sb.getService("vjs.framework.extension.platform.services.view.widget.common.action.WidgetAction");
	}
	
//	{
//		"widgetCode":"",//控件编号
//		"operations":[{
//			"type":"",//操作类型：1、设置状态（setStatus）2、下一步骤（nextStep）3、上一步骤（previousStep）4、跳转到指定步骤（specifyStep）
//			"valueType":"",//值类型：1、枚举值（enum）2、表达式（expression）3、无（none）
//			"value":""
//		}]
//	}


	var main = function(ruleContext) {
		var ruleCfgValue = ruleContext.getRuleCfg();
		var inParams = ruleCfgValue["inParams"];
		var inParamsObj = jsonUtil.json2obj(inParams);
		var widgetCode = inParamsObj.widgetCode;
		var widget = widgetContext.get(widgetCode, "widgetObj");
		var operations = inParamsObj.operations;
		if(operations && operations.length > 0){
			for(var i = 0 ; i < operations.length; i ++){
				switch(operations[i].type){
					case "setStatus":
						setStatus(operations[i],widget);
						break;
					case "nextStep":
						brotherStep(operations[i],widget,'next');
						break;
					case "previousStep":
						brotherStep(operations[i],widget,'previous');
						break;
					case "specifyStep":
						specifyStep(operations[i],widget);
						break;
				}
			}
		}
		
		return true;
	};
	
	var setStatus = function(operation,widget){
		executeWidgetAction(widget.Code,"setStepStatus",operation.value);
	}
	
	var brotherStep = function(operation,widget,type){
		executeWidgetAction(widget.Code,"setBrotherStep",type);
	}
	
	var specifyStep = function(operation,widget){
		var currentId = analysizeOperationValue(operation,widget);
		executeWidgetAction(widget.Code,"setCurrentRecord",currentId);
	}
	
	var executeWidgetAction = function(widgetId,eventName,args){
		actionHandler.executeWidgetAction(widgetId,eventName,args);
	}

	var analysizeOperationValue = function(operation,widget){
		var value = "";
		if(operation.valueType == "expression"){
			var context = new ExpressionContext();
			if(operation.value.indexOf('[') == 0){
				var entityName = operation.value.split('.')[0].slice(1,operation.value.split('.')[0].length-1);
				var fieldName = operation.value.split('.')[1].slice(1,operation.value.split('.')[1].length-1);
				if(entityName){
					var _this = this;
					if(!widget.hasObserver){
						var observer = new CurrentRecordObserver(entityName,'',{},[fieldName]);
						observer.setWidgetValueHandler(function(record){
							widget.hasObserver = true;
							specifyStep(operation,widget)
						})
						observer.clearWidgetValueHandler(function(record){
							widget.hasObserver = true;
							specifyStep(operation,widget)
						})
						observerManager.addObserver({
				    		observer:observer
				    	});
					}
				}
			}
			value = formulaEngine.execute({
				"expression": operation.value,
				"context": context
			});
		}else{
			value = operation.value;
		}
		return value;
	}
	
	
	exports.main = main;

export{    main}