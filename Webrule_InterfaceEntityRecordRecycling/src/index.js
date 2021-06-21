/**
 *  界面实体记录循环处理
 */

	// 加载
	var jsonUtil ;
	var DatasourceManager;
	var ComponentParam;
	var WindowParam;
	var ExpressionContext;
	var Engine;
	var DatasourceUtil;
	var log;
	exports.initModule = function(sBox){
		 jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
		 log = sBox.getService("vjs.framework.extension.util.log");
		 DatasourceManager = sBox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
		 ComponentParam = sBox.getService("vjs.framework.extension.platform.data.storage.runtime.param.ComponentParam");
		 WindowParam = sBox.getService("vjs.framework.extension.platform.services.param.manager.WindowParam");
		 ExpressionContext = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
		 Engine = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
		 DatasourceUtil = sBox.getService("vjs.framework.extension.platform.services.view.logic.datasource.DatasourceUtil");
		
	}
	var TYPENAME = "SourceType"; // mappingItems中类型字段的名称
	var FORMULANAME = "FieldValue"; // mappingItems中来源字段的名称
	var DESTFIELD = "TargetField"; // mappingItems中目标字段的名称
	var TYPE_DATASET = "3"; // 类型：数据集
	var TYPE_FIELD = "4"; // 类型：组件实体
	var TYPE_SYSVAR = "1"; // 类型：系统变量
	var TYPE_COMPONENTVAR = "5"; // 类型：组件变量
	var TYPE_EXPRESSION = "2"; // 类型：表达式
	var TYPE_EXPRESSIONS = "expression";
	
	// 规则主入口(必须有)
	var main = function (ruleContext) {
		// 获取数据
		var ruleCfg = ruleContext.getRuleCfg();
		var params = ruleCfg["inParams"];
		var inParamsObj = jsonUtil.json2obj(params);
		var dsName = inParamsObj["TargetEntity"]; // 目标实体数据源
		var queryConds = inParamsObj["Conditions"]; // 其他条件的配置
		
//		var records = viewModel.getDataModule().getAllRecordsByDS(dsName);
		var datasource = DatasourceManager.lookup({"datasourceName":dsName});
		var records = datasource.getAllRecords().toArray();
		
		
		if (undefined != records && null != records && records.length > 0) {
			var updateRecords = [];
			
			if (undefined != queryConds && null != queryConds && queryConds.length > 0) {
				for (var index = 0; index < records.length; index++) {
					var record = records[index];
					var context = new ExpressionContext();
					context.setRouteContext(ruleContext.getRouteContext());
					context.setRecords([record]);
					
					var isEditRecord = false;
					for (var i = 0; i < queryConds.length; i++) {
						var exp = queryConds[i]["Condition"]; // 条件
						var mappingItems = queryConds[i]["Fields"]; // 源表中的字段与目标表中的字段的映射关系
						var ret = Engine.execute({"expression":exp,"context":context});
//						var ret = formulaUtil.evalExpressionByRecords(exp, record);
						if (typeof ret != "boolean"&&ret) {
							throw new Error("条件必须返回布尔类型，请检查");
						}else if(ret==null){
							ret = false;
						}
						
						if (ret == true) {
							for (var mappIndex = 0; mappIndex < mappingItems.length; mappIndex++) {
								var mappingItem = mappingItems[mappIndex];
								var type = mappingItem[TYPENAME];
								var formula = mappingItem[FORMULANAME];
								var destField = mappingItem[DESTFIELD];
								destField = destField.substring(destField.indexOf(".") + 1);
								try{
									var testVal =  calculateValue(type, formula, dsName, record,ruleContext);
									record.set(destField,testVal);
								}catch(e){
									var msg = "执行计算表达式【"+ formula +"】失败，原因" + e.message;
									log.log(msg);
								}
								
							}
							isEditRecord = true;
						}
					}
					if(isEditRecord){
						updateRecords.push(record);
					}
				}
			}
			if (undefined != updateRecords && null != updateRecords && updateRecords.length > 0) {
				DatasourceUtil.setBaseValue(dsName, updateRecords)
//				viewModel.getDataModule().setBaseValueByDS(dsName, updateRecords);
			}
		}
	};
	
	/**
	 *	根据配置信息获取值
	 *
	 *  @param  type	    	源字段类型
	 *  @param	formula		  	源字段内容
	 *  @param  obj             目标实体当前行（用于表达式计算）
	 */
	var calculateValue = function (type, formula, dsName, record,ruleContext) {
		var retValue;
		var datasource = DatasourceManager.lookup({"datasourceName":dsName});
		
		switch (type) {
		case TYPE_DATASET:
		case TYPE_FIELD:
			var formulaDS = formula.substring(0, formula.indexOf("."));
			formula = formula.substring(formula.indexOf(".") + 1);
			if(dsName == formulaDS){
				retValue = record.get(formula);
			}else{
				var currRecord = datasource.getCurrentRecord();
				retValue = currRecord.get(formula);
//				retValue = viewModel.getDataModule().getSingleValueByDS(formulaDS, formula);
			}
			break;
			
		case TYPE_SYSVAR:
			retValue = ComponentParam.getVariant({"code":formula});
//			retValue = viewContext.getSystemVariableValue(formula);
			break;
			
		case TYPE_COMPONENTVAR:
			retValue = WindowParam.getInput({"code":formula});
//			retValue = viewContext.getVariableValue(formula);
			break;
		case TYPE_EXPRESSION:
		case TYPE_EXPRESSIONS:
				var context = new ExpressionContext();
				context.setRouteContext(ruleContext.getRouteContext());
				context.setRecords([record]);
				retValue = Engine.execute({"expression":formula,"context":context});
//			retValue = formulaUtil.evalExpressionByRecords(formula, record);
			break;
		default:
			retValue = "";
			break;
		}
		return retValue;
	};
	// 注册规则主入口方法(必须有)
	exports.main = main;

export{    main}