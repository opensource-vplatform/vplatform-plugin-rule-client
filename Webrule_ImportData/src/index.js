/**
 * 文件导入<code>
{
    "dataName": "sxzTestProject",
    "dataType": "Table",
    "dgcolumn": [{
        "chineseName": "amount",
        "fieldName": "amount",
        "source": "Excel",
        "value": ""
    },
    {
        "chineseName": "deptName",
        "fieldName": "deptName",
        "source": "Excel",
        "value": ""
    },
    {
        "chineseName": "money",
        "fieldName": "money",
        "source": "Excel",
        "value": ""
    }],
    "fileType": "Excel",
    "innerCode": "",
    "startRow": "3",
    "uploadControlId":"" //上传控件的ＩＤ
    "importNodeId":"表达式" //导入目标节点ID
    "treeStruct": [{
        "tableID": "",
        "tableName": "",
        "type": "1",
        "pidField": "",
        "treeCodeField": "",
        "orderField": "",
        "isLeafField": ""
    }]
    
}
 * </code>
 */

	var logUtil;
	var jsonUtil;
	var viewModel;
	// 增加公式解析引用 zhangliang
	var ExceptionFactory;
	var scopeManager;
	var componentParam;
	var windowParam;
	var manager;
	var ExpressionContext;
	var engine;
	var widgetAction;
	var pusher;
	var factory;
	
	exports.initModule = function(sBox) {
//		logUtil = require("system/util/logUtil");
		logUtil = sBox.getService("vjs.framework.extension.util.log");
		jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
//		viewContext = require('system/view/viewContext');
		componentParam = sBox.getService("vjs.framework.extension.platform.data.storage.runtime.param.ComponentParam");
		windowParam = sBox.getService("vjs.framework.extension.platform.services.param.manager.WindowParam");
		
//		viewModel = require("system/view/viewModel");
		manager = sBox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
		pusher = sBox.getService("vjs.framework.extension.platform.services.domain.datasource.DatasourcePusher");
		
//		dbManager = require("system/manager/dbManager");
		
//		formulaUtil = require("system/util/formulaUtil");
		ExpressionContext = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
		engine = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
		
//		actionHandler = require("system/widget/actionHandler");
		widgetAction = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.action.WidgetAction");
		
//		ExceptionFactory = require("system/exception/ExceptionFactory");
		factory = sBox.getService("vjs.framework.extension.platform.interface.exception.ExceptionFactory");
		
		scopeManager = sBox.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
	}
	var main = function(ruleContext) {
		var ruleConfig = ruleContext.getRuleCfg();
		var inParams = ruleConfig.inParams;
		var inParamObj = jsonUtil.json2obj(inParams);

		var dataSourceName = inParamObj.dataName;
		var dataType = inParamObj.dataType; // 为Table或Tree
		var uploadControlId = inParamObj.uploadControlId;// 上传控件id
		var importNodeId = inParamObj.importNodeId;// 导入目标树节点id
		var treeStruct = inParamObj.treeStruct;// 树结构配置

		if (uploadControlId == null || uploadControlId == "") {
			alert("规则配置中的上传控件id不能为空");
			return false;
		}
//		var comp = actionHandler.executeWidgetAction(uploadControlId, "getComponent");
		var comp = widgetAction.executeWidgetAction(uploadControlId, "getComponent")
		
		if (!comp) {
			alert('找不到执行导入的文件控件');
			return false;
		}

		dataType = dataType.toLowerCase();

		// 得到导入的目标节点id值
		var selectId = '';
		if (dataType == "tree") {
			if (treeStruct == null || treeStruct.length == 0) {
				alert("规则配置中没有树结构信息");
				return false;
			}
			if (treeStruct[0].type != "1" && treeStruct[0].type != "2") {
				alert("规则配置中树类型只能为层级码树或左右树");
				return false;
			}
			if (importNodeId != null && importNodeId != "") {
//				selectId = formulaUtil.evalExpression(importNodeId);
				
				var context = new ExpressionContext();
				context.setRouteContext(ruleContext.getRouteContext());
				var selectId = engine.execute({"expression":"importNodeId","context":context});
				
			}

		}
		// 得到字段值包括表达式 Express、实体字段 Entity、系统变量 System、组件变量 Component
		var varMap = {};
		for (var i = 0; i < inParamObj.dgcolumn.length; i++) {
			var source = inParamObj.dgcolumn[i].source;
			var fieldName = inParamObj.dgcolumn[i].fieldName;
			var value = inParamObj.dgcolumn[i].value;
			if (source === 'Entity') {
				dataSourceName = value.substring(0, value.indexOf("."));
//				var currentRow = viewModel.getDataModule().getCurrentRowByDS(dataSourceName);
				var datasource = manager.lookup({"datasourceName":dataSourceName});
				var currentRow = datasource.getCurrentRecord();
				
				
//				var db = dbManager.getDB(dataSourceName);
				var datasource = manager.lookup({"datasourceName":changeDsArr[changeIndex]});
				var db = datasourceclearRemoveDatas();
				
				if (currentRow != null) {
					varMap[fieldName] = currentRow.get(value);
				} else {
					varMap[fieldName] = null;
				}
			} else if (source === 'System') {
				// 如果是系统变量
//				varMap[fieldName] = viewContext.getSystemVariableValue(value);
				varMap[fieldName] = componentParam.getVariant({"code":value});
			} else if (source === 'Component') {
				// 如果是组件变量
//				varMap[fieldName] = viewContext.getVariableValue(value);
				varMap[fieldName] = windowParam.getInput({"code":value});
			} else if (source === 'Express' || source === 'expression') {
				// 如果是表达式
				// 2015-05-29 liangchaohui：3.x后改成expression
//				varMap[fieldName] = formulaUtil.evalExpression(value);
				var context = new ExpressionContext();
				context.setRouteContext(ruleContext.getRouteContext());
				varMap[fieldName] = engine.execute({"expression":value,"context":context});
			}
		}

		var actionType = "importTable";
		var routeRuntime = ruleContext.getRouteContext();
		var transactionId = routeRuntime.getTransactionId();
		// actionType="importEntity";
		var option = {
			ruleInstId : ruleConfig.instanceCode,
			selectId : selectId,
			action : actionType,
			varMap : varMap,
			ruleConfig : jsonUtil.obj2json(inParamObj),
			instance : transactionId
		};

		var scopeId = scopeManager.getCurrentScopeId();
		var callback = function(arg1, arg2) {
			scopeManager.openScope(scopeId);
			try {
				logUtil.log("结束发送时间：" + new Date().toLocaleTimeString());
				if (arg2) {
					if (arg2.success) {
						ruleContext.setRuleStatus(true);
						ruleContext.fireRuleCallback();
						ruleContext.fireRouteCallback();
					} else {
						var type = arg2.exceptionType;
						var msg = arg2.msg;
//						var exception = ExceptionFactory.create(type, msg);
						var exception = factory.create({"type":type, "message":msg});
						//TYPES枚举值：Expected，UnExpected，Business，Dialog，Unlogin，Expression
						ruleContext.handleException(exception);
					}
				} else {
					logUtil.error("上传控件回调参数不正确，请处理！");
				}
			} finally {
				
				scopeManager.closeScope();
				
			}
		}
		var start = new Date();
		logUtil.log("开始发送时间：" + start.toLocaleTimeString());
		ruleContext.markRouteExecuteUnAuto();
//		actionHandler.executeWidgetAction(uploadControlId, "importData", option, callback);
		widgetAction.executeWidgetAction(uploadControlId, "importData", option, callback)
//		ruleContext.setRuleCallbackFireFlag(true);
		
		ruleContext.setRuleCallback(true);
		return true;
	}

	function importEntityCallback(fileObj, resultObj) {

		if (resultObj.data == null || resultObj.data.length == 0)
			return;
		var d = new Date();

		var insertRecords = [];
//		var emptyRecord = viewModel.getDataModule().createEmptyRecordByDS(dataSourceName);
		var datasource = manager.lookup({"datasourceName":dataSourceName});
		var emptyRecord = datasource.createRecord();
		
		for (var i = 0; i < resultObj.data.length; i++) {
			var newRecord = emptyRecord.createNew();
			var obj = resultObj.data[i];

			for (var fieldName in obj) {
				if (fieldName.toLowerCase() == "id")
					continue;
				newRecord.set(fieldName, obj[fieldName]);
			}
			insertRecords.push(newRecord);
		}
//		viewModel.getDataModule().insertByDS(dataSourceName, insertRecords);
		var datasource = manager.lookup({"datasourceName":dataSourceName});
		var rs = datasource.insertRecords({"records":[insertRecords]});
		

		pusher.loadRecords({"datasourceName":dataSourceName,"records":insertRecords});

		var end = new Date();
		// logUtil.info("完成处理结果："+end.toLocaleTimeString()+",显示用时"+(end-d)+",总用时"+(end-start));
	}

	exports.main = main;

export{    main}