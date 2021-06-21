/**
 * 计算公式的值并赋值给指定字段(计算公式为数值型字段对应关键字和“+、-、*、/、(、)”组成的计算表达式。例如:赋值字段为单价，要计算单价(fPrice)*数量(fAmount)并赋值到金额(FMoney)字段，赋值字段可以设置为fMoney，计算公式可定义为
 * fPrice*fAmount。)
 */

	var jsonUtil;
	var formulaUtil;
	var widgetContext;
	var storeTypes;
	var ExpressionContext;
	var windowVmManager;
	var manager;
	var sandbox;
	var pusher;
	var log;
	exports.initModule = function(sBox) {
		sandbox = sBox;
		manager = sBox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
		windowVmManager = sBox.getService("vjs.framework.extension.platform.services.vmmapping.manager.WindowVMMappingManager");
		jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
		widgetContext = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.context.WidgetContext");
		storeTypes = sBox.getService("vjs.framework.extension.platform.interface.enum.StoreTypes");
		formulaUtil = sBox.getService("vjs.framework.extension.platform.engine.expression.ExpressionEngine");
		ExpressionContext = sBox.getService("vjs.framework.extension.platform.engine.expression.ExpressionContext");
		pusher = sBox.getService("vjs.framework.extension.platform.services.domain.datasource.DatasourcePusher");
		log = sBox.getService("vjs.framework.extension.util.log");

	}

	var main = function(ruleContext) {
		var ruleCfgValue = ruleContext.getRuleCfg();
		var inParams = ruleCfgValue["inParams"];
		var inParamsObj = jsonUtil.json2obj(inParams)

		// 根据key获取规则配置参数值
		var destFieldName = inParamsObj["destFieldName"]; // 赋值字段的fieldName
		var dest = destFieldName.split(".");
		var calFormula = inParamsObj["formula"]; // 计算公式
		var dsName = dest[0];
		destFieldName = dest[1];
		var refWidgetIds = windowVmManager.getWidgetCodesByDatasourceName({
			"datasourceName": dsName
		});
		var flag = true;
		for (var index = 0; index < refWidgetIds.length; index++) {
			var retWidgetId = refWidgetIds[index];
			var widgetType = widgetContext.get(retWidgetId, "widgetType");
			var storeType = widgetContext.getStoreType(retWidgetId);
			if (storeType == storeTypes.SET) {
				var dsNames = windowVmManager.getDatasourceNamesByWidgetCode({
					"widgetCode": retWidgetId
				});
				var datasource = manager.lookup({
					"datasourceName": dsNames[0]
				});
				var record = datasource.getCurrentRecord();
				if (!record) {
					return;
				}
				flag = false;
				calculateValueForSet(calFormula, dsName, destFieldName,
					record, ruleContext);
				break;
			} else if (storeType == storeTypes.SINGLE_RECORD) {
				var fields = windowVmManager.getFieldCodesByWidgetCode({
					"widgetCode": retWidgetId
				});
				if (fields && fields.length > 0) {
					for (var i = 0; i < fields.length; i++) {
						var field = fields[i];
						if (field["refField"] == destFieldName) {
							flag = false;
							calculateValueForSingleValue(calFormula, dsName,
								destFieldName, ruleContext);
							break;
						}
					}
				}

			} else if (storeType == storeTypes.SINGLE_RECORD_MULTI_VALUE) {
				var fields = windowVmManager.getFieldCodesByWidgetCode({
					"widgetCode": retWidgetId
				});
				if (fields && fields.length > 0) {
					for (var i = 0; i < fields.length; i++) {
						var field = fields[i];
						if (field["refField"] == destFieldName) {
							flag = false;
							calculateValueForSingleMultiValue(calFormula, dsName,
								destFieldName, ruleContext);
							break;
						}
					}
				}

			}
		}
		if (flag == true) {
			calculateValueForSingleValue(calFormula, dsName,
				destFieldName, ruleContext);
		}
	};

	/**
	 * 根据公式串与公式中的字段的fieldName计算公式值赋值给单行多值控件的fieldname。
	 *
	 * @param calFormula
	 *            公式串 如：(HT_FKJH.JHBH+2)*HT_FKJH.BZ
	 * @param dsName
	 *            赋值字段的dsName
	 * @param destFieldName
	 *            赋值字段的fieldname
	 */
	var calculateValueForSingleMultiValue = function(calFormula, dsName, destFieldName, ruleContext) {
		// 对公式进行计算
		var context = new ExpressionContext();
		context.setRouteContext(ruleContext.getRouteContext());
		try{
			var value = formulaUtil.execute({
				"expression": calFormula,
				"context": context
			});
			var obj = {};
			obj[destFieldName] = value;
			var pusher = sandbox.getService("vjs.framework.extension.platform.services.domain.datasource.DatasourcePusher");
			pusher.setValues({
				"datasourceName": dsName,
				"values": obj
			});
		}catch(e){
			var msg = "执行字段计算表达式【"+ calFormula +"】失败，原因" + e.message;
			log.log(msg);
		}
		
	};

	/**
	 * 根据公式串与公式中的字段的fieldName计算公式值赋值给单值控件的fieldname。
	 *
	 * @param calFormula
	 *            公式串 如：(HT_FKJH.JHBH+2)*HT_FKJH.BZ
	 * @param dsName
	 *            赋值字段的dsName
	 * @param destFieldName
	 *            赋值字段的fieldname
	 */
	var calculateValueForSingleValue = function(calFormula, dsName, destFieldName, ruleContext) {
		// 对公式进行计算
		// TODO:直接进行赋值 value = new Number(value).toFixed(4);
		// 对应字段赋值
		var context = new ExpressionContext();
		context.setRouteContext(ruleContext.getRouteContext());
		try{
			var value = formulaUtil.execute({
				"expression": calFormula,
				"context": context
			});
			pusher.setFieldValue({"datasourceName":dsName,"fieldCode":destFieldName,"value":value});
		}catch(e){
			var msg = "执行字段计算表达式【"+ calFormula +"】失败，原因" + e.message;
			log.log(msg);
		}
		
		


	};

	/**
	 * 根据公式串与公式中的字段的fieldName计算公式值赋值集合控件的对应行的某一列。
	 *
	 * @param calFormula
	 *            公式串 如：(HT_FKJH.JHBH+2)*HT_FKJH.BZ
	 * @param dsName
	 *            赋值字段的dsName
	 * @param destFieldName
	 *            赋值字段的fieldname
	 * @param record
	 *            集合控件操作行的数据
	 */
	var calculateValueForSet = function(calFormula, dsName, destFieldName, record, ruleContext) {
		var context = new ExpressionContext();
		context.setRouteContext(ruleContext.getRouteContext());
		try{
			var value = formulaUtil.execute({
				"expression": calFormula,
				"context": context
			});
			record.set(destFieldName, value); //TODO:直接进行赋值，
			// 对应字段赋值
			var datasource = manager.lookup({
				"datasourceName": dsName
			});
			datasource.updateRecords({
				"records": [record]
			});
		}catch(e){
			var msg = "执行字段计算表达式【"+ calFormula +"】失败，原因" + e.message;
			log.log(msg);
		}
		
	};
	// 注册规则主入口方法(必须有)
	exports.main = main;

export{    main}