/**
 *  必填项检查
 */

vds.import("vds.object.*", "vds.exception.*", "vds.expression.*", "vds.message.*", "vds.log.*", "vds.rpc.*", "vds.ds.*", "vds.widget.*");

// 规则主入口(必须有)
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			// 处理规则配置值
			var inParamsObjs = ruleContext.getVplatformInput();
			var validatorItems = inParamsObjs["fieldList"];
			var messageType = inParamsObjs["type"];
			// 根据key获取规则配置参数值
			var checkMsgs = [];

			var tableFieldsMap = {};
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
					var fields = tableFieldsMap[key];
					if (fields == null) {
						fields = vds.ds.lookup(dsName).getMetadata().getFields();
						tableFieldsMap[key] = fields;
					}

					var fieldNameCN = "";
					for (var i = 0; i < fields.length; i++) {
						if (filedName.toLowerCase() == fields[i].getCode().toLowerCase()) {
							fieldNameCN = fields[i].getName();
							if (null == fieldNameCN || "" == fieldNameCN) {
								fieldNameCN = fields[i].getCode();
							}
							break;
						}
					}

					columnName = columnName.substring(columnName.indexOf(".") + 1);
					var records = vds.ds.lookup(dsName).getAllRecords().toArray();
					if (records != null && records.length > 0) {
						for (var tmp = 0; tmp < records.length; tmp++) {
							var record = records[tmp];
							var value = record.get(columnName);
							if ((!value && value != 0) || vds.string.trim(String(value)) == "") {
								if (errorQuired.indexOf(dsName) == -1) {
									errorQuired.push(dsName);
								}
								// 如果只有一行数据，不必提示第*行，来源孟要锋BUG，2013-5-28
								if (records.length == 1) {
									var tmpl = vds.i18n.get("【${a}】必填！", "必填规则的提示信息");
									tmpl = vds.string.template(tmpl, {
										'a': fieldNameCN
									}).toString();
									checkMsgs.push(tmpl);
								} else {
									var tree = vds.tree.lookup(dsName);
									var tmpl = vds.i18n.get("第${a}行【${b}】必填！", "必填规则的提示信息");
									if (tree.length > 0) {
										//树
										if (tree.length > 1) {
											//多个树
											throw new Error('实体' + dsName + '绑定了多个树形实例，无法进行必填项检查。');
										}
										var id = record.getSysId();
										var treeIndex = tree[0].getIndexById(id);
										tmpl = vds.string.template(tmpl, {
											'a': treeIndex,
											'b': fieldNameCN
										});
									} else {
										tmpl = vds.string.template(tmpl, {
											'a': (tmp + 1),
											'b': fieldNameCN
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
			var callback = function (val) {
				userConfirm = typeof (val) == "boolean" ? val : userConfirm;
				setBusinessRuleResult(ruleContext, checkMsgs.length == 0, userConfirm);
				resolve();
			}
			if (checkMsgs.length > 0) {
				/* 校验不通过的才尝试校验窗体内div里面的必填 */
				validateVui(errorQuired);
				if (messageType == 0) { //提示，继续执行
					var promise = vds.message.info(checkMsgs.join("\n"));
					promise.then(callback).catch(reject);
				} else if (messageType == 1) { //警告，继续执行
					var promise = vds.message.warn(checkMsgs.join("\n"));
					promise.then(callback).catch(reject);
				} else if (messageType == 2) { //错误，不能继续
					var promise = vds.message.error(checkMsgs.join("\n"));
					promise.then(callback).catch(reject);
				} else if (messageType == 3) { //询问（确定/取消），根据用户选择继续或终止
					var promise = vds.message.confirm(checkMsgs.join("\n"));
					promise.then(callback).catch(reject);
				} else if (messageType == 4) { //不提示
					setBusinessRuleResult(ruleContext, checkMsgs.length == 0, userConfirm);
				} else {
					alert("--------------------");
				}
			} else {
				setBusinessRuleResult(ruleContext, checkMsgs.length == 0, userConfirm);
			}
		} catch (ex) {
			reject(ex);
		}
	});
};

var validateVui = function (entityCodes) {
	var codes = vds.widget.getWidgetCodesByType("JGDiv");
	for (var code in codes) {
		vds.widget.execute(code, "validate", [entityCodes]);
	}
}

/**
 * 设置业务返回结果
 */
function setBusinessRuleResult(ruleContext, result, userConfirm) {
	if (ruleContext.setResult) {
		ruleContext.setResult({
			isCheckRequiredOK: result, //业务返回结果：校验是否通过
			confirm: userConfirm
		});
	}
}
export { main }