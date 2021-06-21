/**
 *	数值校验业务规则
 *  jiangxf 2012-5-21
 */

	var jsonUtil;
	var formulaUtil;
	var widgetAttribute;
	var log;
	var mathUtil;
	var stringUtil;
	var datasourceManager;
	var windowVmManager;
	var widgetContext;
	var widgetProperty;
	var componentParam;
	var windowParam;
	var ExpressionContext;
	var DBFactory;
	var factory;
	var dialogUtil;
	var expressType;
	var i18n;
	var ERRORNAME;
	var easyTemplateUtil;

	exports.initModule = function(sBox) {
		jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
		datasourceManager = sBox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
		windowVmManager = sBox.getService("vjs.framework.extension.platform.services.vmmapping.manager.WindowVMMappingManager");
		formulaUtil = sBox.getService("vjs.framework.extension.platform.engine.expression.ExpressionEngine");
		ExpressionContext = sBox.getService("vjs.framework.extension.platform.engine.expression.ExpressionContext");
		windowParam = sBox.getService("vjs.framework.extension.platform.services.param.manager.WindowParam");
		widgetProperty = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.action.WidgetProperty");
		widgetContext = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.context.WidgetContext");
		widgetAttribute = sBox.getService("vjs.framework.extension.platform.interface.enum.StoreTypes");
		componentParam = sBox.getService("vjs.framework.extension.platform.data.storage.runtime.param.ComponentParam");
		log = sBox.getService("vjs.framework.extension.util.log");
		mathUtil = sBox.getService("vjs.framework.extension.util.Math");
		stringUtil = sBox.getService("vjs.framework.extension.util.StringUtil");
		dialogUtil = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.dialog.DialogUtil");
		DBFactory = sBox.getService("vjs.framework.extension.platform.interface.model.datasource.DatasourceFactory");
		factory = sBox.getService("vjs.framework.extension.platform.interface.exception.ExceptionFactory");
		sb = sBox;
		i18n = sb.getService("vjs.framework.extension.platform.interface.i18n.platform");
		easyTemplateUtil = sb.getService("vjs.framework.extension.util.EasyTemplateUtil");
	}
	/**
	 * 校验不为空
	 */
	var isNotEmpty = function(str) {
		return !stringUtil.isEmpty(str);
	}

	/**
	 * 校验是否数字
	 */
	var judgeNumExt = function(num) {
		return mathUtil.isNum(num);
	}

	/**
	 * 校验身份证号码（15位/18位）
	 */
	function isIdCardNo(idCardNum) {
		var aCity = {
			11: i18n.get("北京","城市名称"),
			12: i18n.get("天津","城市名称"),
			13: i18n.get("河北","城市名称"),
			14: i18n.get("山西","城市名称"),
			15: i18n.get("内蒙古","城市名称"),
			21: i18n.get("辽宁","城市名称"),
			22: i18n.get("吉林","城市名称"),
			23: i18n.get("黑龙江","城市名称"),
			31: i18n.get("上海","城市名称"),
			32: i18n.get("江苏","城市名称"),
			33: i18n.get("浙江","城市名称"),
			34: i18n.get("安徽","城市名称"),
			35: i18n.get("福建","城市名称"),
			36: i18n.get("江西","城市名称"),
			37: i18n.get("山东","城市名称"),
			41: i18n.get("河南","城市名称"),
			42: i18n.get("湖北","城市名称"),
			43: i18n.get("湖南","城市名称"),
			44: i18n.get("广东","城市名称"),
			45: i18n.get("广西","城市名称"),
			46: i18n.get("海南","城市名称"),
			50: i18n.get("重庆","城市名称"),
			51: i18n.get("四川","城市名称"),
			52: i18n.get("贵州","城市名称"),
			53: i18n.get("云南","城市名称"),
			54: i18n.get("西藏","城市名称"),
			61: i18n.get("陕西","城市名称"),
			62: i18n.get("甘肃","城市名称"),
			63: i18n.get("青海","城市名称"),
			64: i18n.get("宁夏","城市名称"),
			65: i18n.get("新疆","城市名称"),
			71: i18n.get("台湾","城市名称"),
			81: i18n.get("香港","城市名称"),
			82: i18n.get("澳门","城市名称"),
			91: i18n.get("国外","城市名称")
		}
		if(idCardNum == null){
			log.error("身份证号码存在空值");
			return false;
		}
		idCardNum = idCardNum.toUpperCase();
		//身份证号码为15位或者18位，15位时全为数字，18位前17位为数字，最后一位是校验位，可能为数字或字符X。
		if (!(/(^\d{15}$)|(^\d{17}([0-9]|X)$)/.test(idCardNum))) {
			log.error("身份证号长度不对，或者号码不符合规定！15位号码应全为数字，18位号码末位可以为数字或X。");
			return false;
		}
		//下面分别分析出生日期和校验位
		var len = idCardNum.length;
		if (len == 15) {
			re = new RegExp(/^(\d{2})(\d{4})(\d{2})(\d{2})(\d{2})(\d{3})$/);
			var arrSplit = idCardNum.match(re);
			if (aCity[parseInt(arrSplit[1])] == null) {
				log.error("15位身份证号码中存在非法地区，请检查");
				return false;
			}
			//检查生日日期是否正确
			var dtmBirth = new Date("19" + arrSplit[3] + "/" + arrSplit[4] + "/" + arrSplit[5]);
			var bGoodDay = (dtmBirth.getYear() == Number(arrSplit[3])) && ((dtmBirth.getMonth() + 1) == Number(arrSplit[4])) && (dtmBirth.getDate() == Number(arrSplit[5]));
			if (!bGoodDay) {
				log.error("15位身份证号码中存在非法生日，请检查");
				return false;
			}
		}
		if (len == 18) {
			re = new RegExp(/^(\d{2})(\d{4})(\d{4})(\d{2})(\d{2})(\d{3})([0-9]|X)$/);
			var arrSplit = idCardNum.match(re);
			if (aCity[parseInt(arrSplit[1])] == null) {
				log.error("18位身份证号码中存在非法地区，请检查");
				return false;
			}
			//检查生日日期是否正确
			var dtmBirth = new Date(arrSplit[3] + "/" + arrSplit[4] + "/" + arrSplit[5]);
			var bGoodDay = (dtmBirth.getFullYear() == Number(arrSplit[3])) && ((dtmBirth.getMonth() + 1) == Number(arrSplit[4])) && (dtmBirth.getDate() == Number(arrSplit[5]));
			if (!bGoodDay) {
				log.error("18位身份证号码中存在非法生日，请检查");
				return false;
			} else {
				//检验18位身份证的校验码是否正确。
				//校验位按照ISO 7064:1983.MOD 11-2的规定生成，X可以认为是数字10。
				var valnum;
				var arrInt = new Array(7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2);
				var arrCh = new Array('1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2');
				var nTemp = 0,
					i;
				for (i = 0; i < 17; i++) {
					nTemp += idCardNum.substr(i, 1) * arrInt[i];
				}
				valnum = arrCh[nTemp % 11];
				if (valnum != idCardNum.substr(17, 1)) {
					log.error("18位身份证的校验码不正确！末位应为：" + valnum);
					return false;
				}
			}
		}
		return true;
	}

	/**
	 * 校验日期
	 */
	var checkDate = function(dateStr) {
		var reg = /^(\d{1,4})[-\/](\d{1,2})[-\/](\d{1,2})( (\d{1,2}):(\d{1,2}):(\d{1,2}))?$/;
		if(dateStr == null){
			log.error("日期存在空值");
			return false;
		}
		var r = dateStr.match(reg);
		if (r == null) {
			return false;
		} else {
			var result = true;
			r[2] = r[2] - 1;
			if (!r[5]) {
				r[5] = 0
			};
			if (!r[6]) {
				r[6] = 0
			};
			if (!r[7]) {
				r[7] = 0
			};
			var d = new Date(r[1], r[2], r[3], r[5], r[6], r[7]);
			if (d.getFullYear() != r[1]) result = false;
			if (d.getMonth() != r[2]) result = false;
			if (d.getDate() != r[3]) result = false;
			if (d.getHours() != r[5]) result = false;
			if (d.getMinutes() != r[6]) result = false;
			if (d.getSeconds() != r[7]) result = false;
			return result;
		}
	}

	/**
	 * 长度校验
	 */
	var limit = function(str, parameter) {
		var params = parameter.split(",");
		if (params.length != 3) {
			log.error("输入字符长度限制,参数必须为3个并以逗号隔开，请检查");
			return false;
		}
		var min = params[0];
		var max = params[1];
		var byByte = params[2];
		if (!mathUtil.isNum(min) || !mathUtil.isNum(max) || !mathUtil.isNum(byByte)) {
			log.error("输入字符长度限制,参数必须全部为数字");
			return false;
		} else {
			min = new Number(min);
			max = new Number(max);
			byByte = new Number(byByte);
			if (min > max) {
				log.error("输入字符长度限制参数,最小长度必须小于最大长度");
				return false;
			}
			if (byByte != 0 && byByte != 1) {
				log.error("输入字符长度限制,是否按字节比较参数只能是0或者1");
				return false;
			}
		}
		max = max == 0 ? Number.MAX_VALUE : max;
		var len = 0;
		if(str != null){
			if (byByte == 1) {
				len = str.replace(/[^\x00-\xff]/g, "**").length;
			} else {
				len = str.length;
			}
		}
		return min <= len && len <= max;
	}

	/**
	 * 数值区间校验
	 */
	var checkNum = function(num, parameter) {
		if (!mathUtil.isNum(num)) {
			log.error("判断输入数值是否在(n, m)区间,校验内容[" + num + "]必须为数字");
			return false;
		}
		var params = parameter.split(",");
		if (params.length != 2) {
			log.error("判断输入数值是否在(n, m)区间,参数必须为2个并以逗号隔开，请检查");
			return false;
		}
		var min = params[0];
		var max = params[1];
		if (!mathUtil.isNum(min) || !mathUtil.isNum(max)) {
			log.error("判断输入数值是否在(n, m)区间,参数必须全部为数字");
			return false;
		} else {
			num = new Number(num);
			min = new Number(min);
			max = new Number(max);
			if (min > max) {
				log.error("判断输入数值是否在(n, m)区间,最小数值必须小于最大数值");
				return false;
			}
		}
		return min <= num && num <= max;
	}

	/**
	 * 正则表达式校验
	 */
	var checkRegularExp = function(val, regularExp) {
		try {
			var reg = new RegExp(eval("/" + regularExp + "/"));
			var bool = reg.test(val);
			return bool;
		} catch (e) {
			log.error("正则表达式不正确，请检查");
			return false;
		}
	}
	var regs = [
		isNotEmpty, //0.是否为空
		/^[\u0391-\uFFE5]+$/, //1.中文字符
		/^[^\x00-\xff]$/, //2.双字节字符
		/^[A-Za-z]+$/, //3.英文
		/^\d+$/, //4.数字字符串
		/^[-\+]?([1-9]\d+|[0-9])$/, //5.整数
		judgeNumExt, //6.数字(整数/小数)
		/^\w+([-+.]\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*$/, //7.Email地址
		/^http:\/\/([\w-]+\.)+[\w-]+(\/[\w-./?%&=]*)?$/, //8.使用HTTP协议的网址
		/^((\(\d{2,3}\))|(\d{3}\-))?(\(0\d{2,3}\)|0\d{2,3}-)?[1-9]\d{6,7}(\-\d{1,4})?$/, //9.电话号码
		/^\d+(\.\d+)?$/, //10.货币
		/^0?(13[0-9]|15[012356789]|18[0-9]|14[01456789]|16[25679]|17[012356789]|19[012356789])[0-9]{8}$/, //11.手机号码   
		/^\d{6}$/, //12.邮政编码 Ps：2017-02-14 liangzc：支持以0开头的邮编
		isIdCardNo, //13.身份证号码
		/^[1-9]\d{4,}$/, //14.QQ号码
		checkDate, //15.日期
		/^.{6,}$/, //16.密码
		limit, //17.输入字符长度限制(n-最小长度, m-最大长度, k-是否按字节:0否1是。长度不限制填0)
		checkNum, //18.判断输入数值是否在区间(n-最小数值, m-最大数值)
		/^\w+$/, //19.帐号
		checkRegularExp //20.正则表达式
	];

	//规则主入口(必须有)
	var main = function(ruleContext) {
		ERRORNAME = "规则[DataValidationEditor]: ";
		var checkResult = true;
		var userConfirm = true;
		var ruleConfig = ruleContext.getRuleCfg();
		var paramsValue = ruleConfig["inParams"];
		var inParams = jsonUtil.json2obj(paramsValue);

		var messageType = inParams["messageType"];
		var checkData = inParams["checkData"];
		var finalMessage = "";
		var entityErrorMsg = [];//全部实体校验错误信息
		var context = new ExpressionContext();
		context.setRouteContext(ruleContext.getRouteContext());
		for (var i = 0; i < checkData.length; i++) {
			var checkItem = checkData[i];
			var checkType = checkItem["checkType"]; //校验类型
			var dataSource = checkItem["dataSource"]; //数值
			var dataType = checkItem["dataType"]; //数据来源
			var message = checkItem["message"]; //消息提示
			if(null != message && "" != message){
				message = formulaUtil.execute({
					"expression": message,
					"context": context
				});
			}
			var parameter = checkItem["parameter"]; //参数
			var singleEntityError = [];//单个实体校验错误信息
			if(dataType == "expression"){
				expressType = true;
				var currValue = getValueByType(dataType, dataSource, ruleContext);
				var reg = regs[checkType];
				//数字类型校验位空格 直接提示错误
				if (checkType == 6 && currValue && stringUtil.trim(currValue).length == 0) {
					checkResult = false;
					finalMessage += message + "\n";
				} else if (typeof(reg) == "function") {
					if (!reg(currValue, parameter)) {
						checkResult = false;
						finalMessage += message + "\n";
					}
				} else {
					if (!reg.test(currValue)) {
						checkResult = false;
						finalMessage += message + "\n";
					}
				}
			}else if(dataType == "entityfield"){
				expressType = false;
				var dbCode = dataSource.split(".")[0];
				var fieldCode = dataSource.split(".")[1];
				var dataSourceObj = GetDataSource(dbCode,ruleContext);
				var isAddMsg = false;//是否已经添加了错误信息
				if(dataSourceObj){
					var datas = dataSourceObj.getAllRecords().toArray();
					if(datas && datas.length > 0){
						for(var j = 0;j < datas.length;j++){
							var currValue = datas[j].get(fieldCode);
							var reg = regs[checkType];
							//数字类型校验位空格 直接提示错误
							if (checkType == 6 && currValue && stringUtil.trim(currValue).length == 0) {
								checkResult = false;
								if(!isAddMsg){
//									finalMessage += message + "\n"; 
									isAddMsg = true;
								}
								singleEntityError.push(j+1);
							} else if (typeof(reg) == "function") {
								if (!reg(currValue, parameter)) {
									checkResult = false;
									if(!isAddMsg) {
//										finalMessage += message + "\n";
										isAddMsg = true;
									}
									singleEntityError.push(j+1);
								}
							} else {
								if (!reg.test(currValue)) {
									checkResult = false;
									if(!isAddMsg) {
//										finalMessage += message + "\n";
										isAddMsg = true;
									}
									singleEntityError.push(j+1);
								}
							}
						}
						if(isAddMsg){
							var msg = i18n.get("${a} 第${b}行数据校验不通过${c}","数据合法性规则的校验信息");
							msg = easyTemplateUtil.easyTemplate(msg,{
								'a' : message,
								'b' : singleEntityError.join(","),
								'c' : "\n"
							}).toString();
							finalMessage += msg;
						}
					}else{
						finalMessage += message + "\n";
					}
				}else{
					log.error("实体["+dbCode+"]不存在");
					return false;
				}
			}
		}
		var callback = function(val) {
			userConfirm = typeof(val) == "boolean" ? val : userConfirm;
			setBusinessRuleResult(ruleContext, checkResult, userConfirm);
			ruleContext.setRuleStatus(true);
			ruleContext.fireRuleCallback();
			ruleContext.fireRouteCallback();
		}

		//如果检查不通过，处理提示信息
		if (!checkResult) {
			if (messageType == 0) {
				//不提示，直接返回验证结果
				setBusinessRuleResult(ruleContext, checkResult, userConfirm);
			} else {
				if (messageType == 1) { //提示，继续执行
					dialogUtil.propmtDialog(finalMessage, callback, false);
				} else if (messageType == 2) { //警告，继续执行
					dialogUtil.warnDialog(finalMessage, callback, false);
				} else if (messageType == 3) { //错误，不能继续
					dialogUtil.errorDialog(finalMessage, callback, false);
				} else if (messageType == 4) { //询问（确定/取消），根据用户选择继续或终止
					dialogUtil.confirmDialog(finalMessage, callback, false);
				}
				ruleContext.markRouteExecuteUnAuto();
			}
		} else {
			setBusinessRuleResult(ruleContext, checkResult, userConfirm);
		}
		return true;
	};

	/**
	 * 设置业务返回结果
	 */
	function setBusinessRuleResult(ruleContext, result, userConfirm) {
		if (ruleContext.setBusinessRuleResult) {
			ruleContext.setBusinessRuleResult({
				isValidateOK: result, //业务返回结果：校验是否通过
				confirm: userConfirm
			});
		}
	}

	var getValueByType = function(dataType, dataSource, ruleContext) {
		var result = "";
		switch (dataType) {
			case "1": //界面实体				
				var dsName = dataSource.substring(0, dataSource.indexOf("."));
				var colName = dataSource.substring(dataSource.indexOf(".") + 1, dataSource.length);

				var dataSource = datasourceManager.lookup({
					"datasourceName": dsName
				});
				var selectedValues = dataSource.getCurrentRecord();
				if (selectedValues) {
					result = selectedValues.get(colName);
				}
				break;
			case "2": //控件		
				var controlInfo = dataSource.split(".");
				var valueQueryControlID = controlInfo[0];
				var propertyCode = controlInfo[1];
				var widgetType = widgetContext.get(valueQueryControlID, "widgetType");
				var storeType = widgetContext.getStoreType(widgetType);
				if (widgetAttribute.storeTypes.SET == storeType) {
					//该规则不会传入集合控件ID
				} else if (widgetAttribute.storeTypes.SINGLE_RECORD_MULTI_VALUE == storeType) {
					// 单记录多值控件，按照控件属性名字取得关联的标识，再进行取值
					//	var multiValue = viewModel.getDataModule().getSingleRecordMultiValue(valueQueryControlID);	
					var dsNames = windowVmManager.getDatasourceNamesByWidgetCode({
						"widgetCode": valueQueryControlID
					});
					var dsName = dsNames[0];
					var dataSource = datasourceManager.lookup({
						"datasourceName": dsName
					});
					var multiValue = dataSource.getCurrentRecord();
					//var widgetType = viewContext.getWidgetContext(valueQueryControlID, "widgetType");
					//var defineFields = definerUtil.getWidgetVirtualFields(widgetType);		            
					//var mappingInfo = viewModel.getMetaModule().getMappingInfo(valueQueryControlID);
					var refField = windowVmManager.getFieldCodeByPropertyCode({
						"widgetCode": valueQueryControlID,
						"propertyCode": propertyCode
					});
					result = multiValue[refField];
					break;
				} else if (widgetAttribute.storeTypes.SINGLE_RECORD == storeType) {
					result = widgetProperty.get(valueQueryControlID, "Value");
				}
				break;
			case "3": //表达式
			case "expression":
				var context = new ExpressionContext();
				context.setRouteContext(ruleContext.getRouteContext());
				result = formulaUtil.execute({
					"expression": dataSource,
					"context": context
				});
				break;
			case "4": //系统变量 
				result = componentParam.getVariant({
					"code": dataSource
				});
				break;
			case "5": //组件变量
				result = windowParam.getInput({
					"code": dataSource
				});
				break;
			default:
				break;
		}
		return !result ? "" : result;
	};
	/**
	 * desc 获取各类数据源（窗体实体、方法实体）
	 * dataSourceName 数据源名称
	 * routeContext 路由上下文
	 * vjs: 
	 * 		"vjs.framework.extension.platform.interface.exception":null,
	 * 		"vjs.framework.extension.platform.services.model.manager.datasource":null
	 * services: 
	 * 		manager = sandbox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
	 * 		DBFactory = sandbox.getService("vjs.framework.extension.platform.interface.model.datasource.DatasourceFactory");
	 * 		ExpressionContext = sandbox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
	 * 		engine = sandbox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
	 * */
	function GetDataSource(dataSourceName,routeContext){
		var dsName = dataSourceName;
		var datasource = null;
		if(dsName!=null && dsName != ""){
			/*本身是实体对象*/
			if(DBFactory.isDatasource(dsName)){
				datasource = dsName;
			}else{
				var context = new ExpressionContext();
				context.setRouteContext(routeContext);
				/*窗体实体*/
				if(dsName.indexOf(".")==-1&&dsName.indexOf("@")==-1){
					datasource = datasourceManager.lookup({
						"datasourceName": dsName
					});
				}else{
					/*方法实体*/
					datasource = formulaUtil.execute({
						"expression": dsName,
						"context": context
					});
				}
			}
		}
		return datasource;
	}
	//注册规则主入口方法(必须有)
	exports.main = main;

export{    main}