/**
 *	单据编号生成
 *  jiangxf 2012-7-3
 *	{
 *  	"dataSource" : "dataSource",//实体表
 *  	"dsColumn" : "dsColumn",//实体字段
 * 		"length" : "length",//流水号位数
 *  	"coverLetter" : "coverLetter",//流水号补位符
 *  	"range" : "range",//0选中行,1所有行,2字段为空的记录
 *  	"content" : [{
 *  		"type" : "type",//0自定义,1表达式,2组件变量,3系统变量,4当前日期时间,5实体字段,6流水号
 *  		"value" : "value",
 *  		"order" : "order"
 *  	}]
 *  }
 **/

var datasourcePuller, serialNumberUtil;

exports.initModule = function (sBox) {
	datasourcePuller = sBox.getService("vjs.framework.extension.platform.services.domain.datasource.DatasourcePuller");
	serialNumberUtil = sBox.getService("vjs.framework.extension.util.SerialNumberUtil");
}

vds.import("vds.component.*", "vds.ds.*", "vds.expression.*", "vds.window.*");

var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var sepcialStrArr = ["/", "%", "_", "[", "]"]; //特殊字符
			var params = ruleContext.getVplatformInput();

			var dataSource = params["dataSource"];
			var dsColumn = params["dsColumn"];
			var length = params["length"];//流水号位数
			if ((length != undefined) && (length != "") && (length != null)) {
				length = vds.expression.execute(length, { "ruleContext": ruleContext });
			}
			var coverLetter = params["coverLetter"];
			var range = params["range"];
			var isReuseSerialNumber = params["isReuseSerialNumber"];
			var content = params["content"];
			//表和实体的映射关系
			var relationTable = params["relationTable"];
			var relationTableColumn = params["relationTableColumn"];
			if (undefined != content && null != content) {
				var sortItem = []; //待组装数组
				var codeSortNum = -1; //流水号对应编号的下标
				var codeSortNums = []; //流水号对应编号的下标
				var frontTotalCount = 0; //流水号前面的所有项数量
				var frontCount = 0; // 流水号前面非关键字项数量
				var backCount = 0; // 流水号后面非关键字项数量
				var prefixStr = ""; // 流水号前面字串
				var suffixStr = ""; // 流水号后面字串
				var prefix = ""; //流水号关键字串
				var isLeftSubFlag = true; // 是否左边截取
				var leftLength = 0; // 从左边截取的字串长度
				var rightLength = 0; // 从右边解决的字串长度
				// 根据order进行排序
				content.sort(function (x, y) {
					return x["order"] - y["order"]
				});
				var totalLength = content.length;
				for (var i = 0; i < totalLength; i++) {
					var item = content[i];
					var type = item["type"];
					var value = item["value"];
					var order = item["order"] * 1;
					var isReGenerate = item["isReGenerate"];
					switch (type) {
						case "0": //自定义
							break;
						case "expression": //表达式
							value = vds.expression.execute(value, { "ruleContext": ruleContext });
							break;
						case "2": //组件变量
							value = vds.window.getInput(value);
							break;
						case "3": //系统变量
							value = vds.component.getVariant(value);
							break;
						case "dateAndTime": //当前日期时间
							value = vds.expression.execute("GetDateString(\"" + value + "\")", { "ruleContext": ruleContext });
							break;
						case "5": //实体字段
							var tempTabName = value.substring(0, value.indexOf("."));
							var tempColName = value.substring(value.indexOf(".") + 1, value.length);
							var datasource = vds.ds.lookup(tempTabName);
							var record = datasource.getCurrentRecord();
							if (record)
								value = record.get(tempColName);
							else
								value = "";
							break;
						case "serialNumber": //流水号
							codeSortNum = i;
							codeSortNums.push(i);
							break;
						default:
							break;
					}
					// 以备后面组装
					sortItem.push(value);
					value = value + "";
					if (type != "serialNumber") {
						// begin:兼容规则改造前数据 原有逻辑是把流水号前的内容值作为前缀
						if (undefined == isReGenerate && codeSortNum == -1) {
							isReGenerate = true;
							item["isReGenerate"] = true;
						}
						// end:兼容规则改造前数据

						// 非流水号项处理
						if (codeSortNum == -1) { // 流水号前面项
							frontTotalCount++;
							if (isReGenerate == true || isReGenerate + "".toLowerCase() == "true") {
								if (value != null) {
									prefix = prefix + value; // 获取key
									leftLength = leftLength + value.length; //获取长度
									// 特殊字符处理
									for (var speIndex = 0; speIndex < sepcialStrArr.length; speIndex++) {
										if (value.indexOf(sepcialStrArr[speIndex]) > -1) {
											if (sepcialStrArr[speIndex] == "/") {
												value = value.replace(/\//gi, "//");
											} else if (sepcialStrArr[speIndex] == "[") {
												value = value.replace(/\[/gi, "/[");
											} else {
												value = value.replace(eval("/" + sepcialStrArr[speIndex] + "/gi"), "/" + sepcialStrArr[speIndex]);
											}
										}
									}
								}
							} else {
								if (type == '0') {
									prefix = prefix + value;
									leftLength = leftLength + value.length; //获取长度
								} else {
									isLeftSubFlag = false;
									frontCount++;
									value = "%"; // 拼接查询串
								}
							}
							if (value != null && value != "null")
								prefixStr = prefixStr + value;
						} else if (codeSortNum > -1) { // 流水号后面项
							if (isReGenerate == true || isReGenerate + "".toLowerCase() == "true") {
								if (value != null) {
									prefix = prefix + value; // 获取key
									rightLength = rightLength + value.length; //获取长度
									// 特殊字符处理
									for (var speIndex = 0; speIndex < sepcialStrArr.length; speIndex++) {
										if (value.indexOf(sepcialStrArr[speIndex]) > -1) {
											if (sepcialStrArr[speIndex] == "/")
												value = value.replace(/\//gi, "//");
											else if (sepcialStrArr[speIndex] == "[")
												value = value.replace(/\[/gi, "/[");
											else
												value = value.replace(eval("/" + sepcialStrArr[speIndex] + "/gi"), "/" + sepcialStrArr[speIndex]);
										}
									}
								}
							} else {
								backCount++;
								value = "%";
							}
							if (value != null && value != "null")
								suffixStr = suffixStr + value;
						}
					}
				}

				var backTotalCount = totalLength - 1 - frontTotalCount; //流水号后面的所有项数量=总项数-流水号项目数1-前面项数
				// 如果流水号项存在，前面项数不为空，后面项数不为空，前面存在非关键字项并且后面存在非关键字项, 那么无法截取数据库中的流水号，故此种情况不允许。
				if (codeSortNum > -1 && frontTotalCount > 0 && backTotalCount > 0 && frontCount > 0 && backCount > 0)
					throw new Error("不支持此配置：不能同时在流水号项两端配置非标识项");

				// 如果是从左边截取截取长度取正数，右边截取长度取负数
				var subLength;
				if (isLeftSubFlag == true)
					subLength = 1 * leftLength;
				else
					subLength = -1 * rightLength;

				// 组装like的字串
				var likeValStr = prefixStr;
				for (var leIndex = 0; leIndex < length; leIndex++)
					likeValStr = likeValStr + "_";
				likeValStr = likeValStr + suffixStr;

				var ids = [];
				switch (range) {
					case "0": //选中行
						// 临时方案：没有选中行数据，取当前行数据
						// 解决协同平台设计管理 单据编号新增实体记录后不能获取选中数据问题
						var selectedValues = datasourcePuller.getSelectedAndCurrentRecords({
							"datasourceName": dataSource
						});
						if (selectedValues && selectedValues.length > 0) {
							for (var i = 0; i < selectedValues.length; i++) {
								ids.push(selectedValues[i].getSysId());
							}
						}
						break;
					case "1": //所有行
						var datasource = vds.ds.lookup(dataSource);
						var selectedValues = datasource.getAllRecords();
						if (selectedValues && selectedValues.toArray().length > 0) {
							selectedValues = selectedValues.toArray();
							for (var i = 0; i < selectedValues.length; i++) {
								ids.push(selectedValues[i].getSysId());
							}
						}
						break;
					case "2": //字段为空的记录
						var datasource = vds.ds.lookup(dataSource);
						var selectedValues = datasource.getAllRecords();
						if (selectedValues && selectedValues.toArray().length > 0) {
							selectedValues = selectedValues.toArray();
							for (var i = 0; i < selectedValues.length; i++) {
								// 判断当前字段为空，保存记录ID
								if (!selectedValues[i].get(dsColumn)) {
									ids.push(selectedValues[i].getSysId());
								}
							}
						}
						break;
					default:
						break;
				}

				var values = [];
				var ds = vds.ds.lookup(dataSource);
				var dtds = [];
				//标记规则为异步
				for (var i = 0; i < ids.length; i++) {
					var dtd = $.Deferred();
					dtds.push(dtd);
					var result = "";
					if (codeSortNums.length > 0) {
						for (var j = 0; j < codeSortNums.length; j++) {
							var curCodeSortNum = codeSortNums[j];
							if (j == 0) {
								if (curCodeSortNum > -1) {
									var windowCode = vds.window.getCode();
									//不缓存流水号时，传入映射的表和表字段
									if (isReuseSerialNumber) {
										var sourceName = dataSource;
										var sourceColumn = dsColumn;
										if (relationTable != undefined && relationTable != null && relationTable != "") {
											sourceName = relationTable;
										}
										if (relationTableColumn != undefined && relationTableColumn != null && relationTableColumn != "") {
											sourceColumn = relationTableColumn;
										}
										var params = {
											"moduleId": windowCode,
											"TableName": sourceName,
											"TableColumn": sourceColumn,
											"prefix": prefix,
											"Length": length,
											"CoverLetter": coverLetter,
											"likeValStr": likeValStr,
											"subLength": subLength,
											"isLeftSubFlag": isLeftSubFlag,
											"isReuseSerialNumber": isReuseSerialNumber,
											"isAsync": true,
											"success": (function (dd) {
												return function (result) {
													sortItem[curCodeSortNum] = result;
													dd.resolve();
												}
											})(dtd)
										};
										serialNumberUtil.getSerialNumber(params);
									} else {
										var params = {
											"moduleId": windowCode,
											"TableName": dataSource,
											"TableColumn": dsColumn,
											"prefix": prefix,
											"Length": length,
											"CoverLetter": coverLetter,
											"likeValStr": likeValStr,
											"subLength": subLength,
											"isLeftSubFlag": isLeftSubFlag,
											"isReuseSerialNumber": isReuseSerialNumber,
											"isAsync": true,
											"success": (function (dd) {
												return function (result) {
													sortItem[curCodeSortNum] = result;
													dd.resolve();
												}
											})(dtd)
										};
										serialNumberUtil.getSerialNumber(params);
									}
								}
							} else { // 如果有多个流水号，那么从二个流水号开始，都取第一个流水号的值
								sortItem[curCodeSortNum] = sortItem[codeSortNums[0]];
							}
						}
					} else {
						dtd.resolve();
					}
					$.when(dtd).done((function (index) {
						return function () {
							//处理最后结果
							var result = "";
							for (var j = 0; j < sortItem.length; j++) {
								var sortValue = sortItem[j];
								if (sortValue != null) {
									result += sortValue;
								}
							}
							// 直接从db获取需要更新的记录
							var value = ds.getRecordById(ids[index]);
							value.set(dsColumn, result);
							values.push(value);
						}
					})(i));
				}
				$.when.apply($.when, dtds).done(function () {
					//更新界面数据
					ds.updateRecords(values);
					resolve();
				});
				$.when.apply($.when, dtds).fail(function () {
					resolve();
				});
			}
		} catch (ex) {
			reject(ex);
		}
	});
};

export { main }