/**
 * 计算公式的值并赋值给指定字段(计算公式为数值型字段对应关键字和“+、-、*、/、(、)”组成的计算表达式。例如:赋值字段为单价，要计算单价(fPrice)*数量(fAmount)并赋值到金额(FMoney)字段，赋值字段可以设置为fMoney，计算公式可定义为
 * fPrice*fAmount。)
 */

vds.import("vds.object.*", "vds.exception.*", "vds.expression.*", "vds.message.*", "vds.log.*", "vds.ds.*", "vds.widget.*");

var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParamsObj = ruleContext.getVplatformInput();
			//获取参数：赋值字段（格式：数据源.字段参数）
			var destFieldName = inParamsObj["destFieldName"];
			var dest = destFieldName.split(".");
			//获取数据源名称
			var dsName = dest[0];
			//获取字段名称
			destFieldName = dest[1];
			//获取参数：计算公式
			var calFormula = inParamsObj["formula"];
			//获取计算公式的值
			var value = exeExpression(calFormula, ruleContext);
			//根据数据源名称获取绑定的控件编号集合
			var refWidgetIds = vds.widget.getWidgetCodes(dsName);
			var flag = true;
			for (var index = 0; index < refWidgetIds.length; index++) {
				var retWidgetId = refWidgetIds[index];
				var storeType = vds.widget.getStoreType(retWidgetId);
				if (storeType == vds.widget.StoreType.Set) {
					var dsNames = vds.widget.getDatasourceCodes(retWidgetId);
					var datasource = vds.ds.lookup(dsNames[0]);
					var record = datasource.getCurrentRecord();
					if (!record) {
						resolve();
						return;
					}
					flag = false;
					calculateValueForSet(datasource, record, destFieldName, value);
					break;
				} else if (storeType == vds.widget.StoreType.SingleRecord || storeType == vds.widget.StoreType.SingleRecordMultiValue) {
					var fields = vds.widget.getFieldCodes(dsName, retWidgetId);
					if (fields && fields.length > 0) {
						for (var i = 0; i < fields.length; i++) {
							var field = fields[i];
							if (field == destFieldName) {
								flag = false;
								calculateValueForSingleValue(dsName, destFieldName, value);
								break;
							}
						}
					}
				}
			}
			if (flag == true) {
				calculateValueForSingleValue(dsName, destFieldName, value);
			}
			resolve();
		} catch (ex) {
			reject(ex);
		}
	});
};

/**
 * 获取计算公式的值
 *
 * @param calFormula
 *            表达式
 * @param ruleContext
 *            规则上下文
 */
var exeExpression = function (calFormula, ruleContext) {
	try {
		//执行表达式
		var value = vds.expression.execute(calFormula, { "ruleContext": ruleContext });
		return value;
	} catch (e) {
		var msg = "执行字段计算表达式【" + calFormula + "】失败，原因" + e.message;
		vds.log.log(msg);
	}
}

/**
 * 给单值控件或单行多值控件字段赋值。
 *
 * @param dsName
 *            赋值字段的dsName
 * @param destFieldName
 *            赋值字段的fieldname
  * @param value
 *            值
 */
var calculateValueForSingleValue = function (dsName, destFieldName, value) {
	var datasource = vds.ds.lookup(dsName);
	var record = datasource.getCurrentRecord();
	if (!record) {
		record = datasource.createRecord();
		record.set(destFieldName, value);
		datasource.insertRecords([record]);
	}
	else {
		record.set(destFieldName, value);
		datasource.updateRecords([record]);
	}
};

/**
 * 给集合控件的对应行的字段赋值。
 *
 * @param dsName
 *            赋值字段的dsName
 * @param destFieldName
 *            赋值字段的fieldname
 * @param record
 *            集合控件操作行的数据
  * @param value
 *            值
 */
var calculateValueForSet = function (datasource, record, destFieldName, value) {
	record.set(destFieldName, value);
	datasource.updateRecords([record]);
};

// 注册规则主入口方法(必须有)
exports.main = main;

export { main }