/**
 *  必填项检查
 */

	var jsonUtil;
	var stringUtil;
	var mapUtil;
	var datasourceManager;
	var widgetAction;
	var dialogUtil;
	var sb;
	var easyTemplateUtil;
	var ExpressionContext;
	var formulaUtil;
	var widgetContext;
	var scopeManager;
	var treeManager;

	exports.initModule = function(sBox) {
		sb = sBox;
		datasourceManager = sBox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
		jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
		stringUtil = sBox.getService("vjs.framework.extension.util.StringUtil");
		mapUtil = sBox.getService("vjs.framework.extension.util.MapUtil");
		widgetAction = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.action.WidgetAction");
		widgetContext = sb.getService("vjs.framework.extension.platform.services.view.widget.common.context.WidgetContext");
		dialogUtil = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.dialog.DialogUtil");
		i18n = sb.getService("vjs.framework.extension.platform.interface.i18n.platform");
		easyTemplateUtil = sb.getService("vjs.framework.extension.util.EasyTemplateUtil");
		ExpressionContext = sb.getService("vjs.framework.extension.platform.engine.expression.ExpressionContext");
		formulaUtil = sb.getService("vjs.framework.extension.platform.engine.expression.ExpressionEngine");
		scopeManager = sb.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
		treeManager = sb.getService("vjs.framework.extension.platform.services.model.manager.tree.TreeManager");
	}

	var executeExpress = function(ruleContext, value){
		if(null == value || "" == value)
			return value;
		var context = new ExpressionContext();
		context.setRouteContext(ruleContext.getRouteContext());
		var result = formulaUtil.execute({
			"expression": value,
			"context": context
		});
		return result; 
	}
	
	// 规则主入口(必须有)
	var main = function(ruleContext) {
		// 获取规则上下文中的规则配置值
		var ruleCfgValue = ruleContext.getRuleCfg();
		// 处理规则配置值
		var inParams = ruleCfgValue["inParams"];
		var inParamsObjs = jsonUtil.json2obj(inParams);
		var validatorItems = inParamsObjs["fieldList"];
		//{"fieldList":[{"chineseName":"FieldData1","field":"HT_QYZZ.FieldData1"},{"chineseName":"FieldData4","field":"HT_HTJS.FieldData4"}],"type":"0"}
		var messageType = inParamsObjs["type"];
		// 根据key获取规则配置参数值
		var checkMsgs = [];

		var tableFieldsMap = new mapUtil.Map();
		/* 问题实体 */
		var errorQuired = [];
		if (validatorItems != null && validatorItems.length > 0) {
			for (var index = 0; index < validatorItems.length; index++) {
				var columns = validatorItems[index];
				var columnName = columns["field"];
				var array = columnName.split(".");
				var dsName = columnName.substring(0, columnName.indexOf("."));
				var filedName = array[1];
				var key = dsName.toLowerCase();
				var fields = tableFieldsMap.get(key);
				if (fields == null) {
					//fields=viewModel.getMetaModule().getMetadataFieldsByDS(dsName);
					fields = datasourceManager.lookup({
						"datasourceName": dsName
					}).getMetadata().getFields();
					tableFieldsMap.put(key, fields);
				}

				//Task20181123097：字段名称暂不支持多语言
//				var fieldNameCN = executeExpress(ruleContext, columns.fieldName);
//				if(null == fieldNameCN || "" == fieldNameCN){
//					fieldNameCN = filedName; 
//				}
				
				var fieldNameCN = "";
				for (var i = 0; i < fields.length; i++) {
					if (filedName.toLowerCase() == fields[i].getCode().toLowerCase()) {
						fieldNameCN = fields[i].getName();
						if(null == fieldNameCN || "" == fieldNameCN){
							fieldNameCN = fields[i].getCode();
						}
						break;
					}
				}
				/*
				for (var i = 0; i < fields.length; i++) {
					if (filedName.toLowerCase() == fields[i].getCode().toLowerCase()) {
						fieldNameCN = fields[i].getName();
						break;
					}
				}*/

				// 如果简体中文字段名称为空，取发布数据的中文名
				/*if (stringUtil.isEmpty(fieldNameCN)){
					fieldNameCN = columns["fieldName"];
				}
				
				// 如果简体中文字段名称为空，取英文名称
				if (stringUtil.isEmpty(fieldNameCN) && columnName.indexOf(".") > 0) {
					fieldNameCN = jsTool.getFieldName(columnName);
				} */
				columnName = columnName.substring(columnName.indexOf(".") + 1);
				//	var records = viewModel.getDataModule().getAllRecordsByDS(dsName);
				var records = datasourceManager.lookup({"datasourceName": dsName}).getAllRecords().toArray();
				if (records != null && records.length > 0) {
					for (var tmp = 0; tmp < records.length; tmp++) {
						var record = records[tmp];
						var value = record.get(columnName);
						if ((!value && value != 0) || stringUtil.trim(String(value)) == "") {
							if(errorQuired.indexOf(dsName) == -1){
								errorQuired.push(dsName);
							}
							// 如果只有一行数据，不必提示第*行，来源孟要锋BUG，2013-5-28
							if (records.length == 1) {
								var tmpl = i18n.get("【${a}】必填！","必填规则的提示信息");
								tmpl = easyTemplateUtil.easyTemplate(tmpl,{
									'a' : fieldNameCN
								}).toString();
								checkMsgs.push(tmpl);
							} else {
								var tree = treeManager.lookupByName({"datasourceName":dsName}); 
								var tmpl = i18n.get("第${a}行【${b}】必填！","必填规则的提示信息");
								if(tree.length > 0){
									//树
									if(tree.length > 1){
										//多个树
										throw new Error('实体' + dsName + '绑定了多个树形实例，无法进行必填项检查。');
										return;
									}
									var id = record.getSysId();
									var treeIndex = tree[0].getIndexById(id);
									tmpl = easyTemplateUtil.easyTemplate(tmpl,{
										'a' : treeIndex,
										'b' : fieldNameCN
									});
								}else{
									tmpl = easyTemplateUtil.easyTemplate(tmpl,{
										'a' : (tmp + 1),
										'b' : fieldNameCN
									});
								}
								checkMsgs.push(tmpl);
							}
						}
					}
				} else {
					//TODO: luohc说没有记录不用检查，说以后要改成检查的话找他(20120627)
					//checkMsgs.push(fieldName + "必填！");
				}
			}
		}
		var userConfirm = true;
		var callback = function(val) {
			userConfirm = typeof(val) == "boolean" ? val : userConfirm;
			setBusinessRuleResult(ruleContext, checkMsgs.length == 0, userConfirm);
			ruleContext.setRuleStatus(true);
			ruleContext.fireRuleCallback();
			ruleContext.fireRouteCallback();
		}
		if (checkMsgs.length > 0) {
			/* 校验不通过的才尝试校验窗体内div里面的必填 */
			validateVui(errorQuired);
			if (messageType == 0) { //提示，继续执行
//				widgetAction.executeComponentAction("propmtDialog", checkMsgs.join("\n"), callback, false);
				dialogUtil.propmtDialog(checkMsgs.join("\n"), callback, false);
			} else if (messageType == 1) { //警告，继续执行
//				widgetAction.executeComponentAction("warnDialog", checkMsgs.join("\n"), callback, false);
				dialogUtil.warnDialog(checkMsgs.join("\n"), callback, false);
			} else if (messageType == 2) { //错误，不能继续
//				widgetAction.executeComponentAction("errorDialog", checkMsgs.join("\n"), callback, false);
				dialogUtil.errorDialog(checkMsgs.join("\n"), callback, false);
			} else if (messageType == 3) { //询问（确定/取消），根据用户选择继续或终止
//				widgetAction.executeComponentAction("confirmDialog", checkMsgs.join("\n") + '\n确定要继续吗？', callback, false);
				dialogUtil.confirmDialog(checkMsgs.join("\n"), callback, false);
			} else if (messageType == 4) { //不提示
				setBusinessRuleResult(ruleContext, checkMsgs.length == 0, userConfirm);
				//ruleContext.setRuleCallbackFireFlag(false);
				return true;
			} else {
				alert("--------------------");
			}
			//ruleContext.setRuleCallbackFireFlag(true);
			ruleContext.markRouteExecuteUnAuto();
		} else {
			setBusinessRuleResult(ruleContext, checkMsgs.length == 0, userConfirm);
		}
		return true;
	};
	
	var validateVui = function(entityCodes){
		var windowScope = scopeManager.getWindowScope();
    	var widgets = windowScope.getWidgets();
    	if(widgets){
    		for(var code in widgets){
    			if(widgets.hasOwnProperty(code) && widgets[code].type && widgets[code].type == "JGDiv"){
    				widgetAction.executeWidgetAction(code,"validate",entityCodes);
    			}
    		}
    	}
	}
	
	/**
	 * 设置业务返回结果
	 */
	function setBusinessRuleResult(ruleContext, result, userConfirm) {
		if (ruleContext.setBusinessRuleResult) {
			ruleContext.setBusinessRuleResult({
				isCheckRequiredOK: result, //业务返回结果：校验是否通过
				confirm: userConfirm
			});
		}
	}

	//注册规则主入口方法(必须有)
	exports.main = main;

export{    main}