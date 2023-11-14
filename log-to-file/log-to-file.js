module.exports = function(RED) {
    // 引入文件系统模块
    var fs = require('fs'); 
    const path = require('path');

    const {scheduleTask} = require("cronosjs");

    var rotate = require('log-rotate');
    let globalfilePath =""
    let globalfileAddDayDir =""
    let logrotate_global = ""
    let logcompress_global = ""
    let logrotatecount_global = ""
    let logsize_global = ""


    function LogToFile(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        this.sendpane = config.sendpane
        this.loglevel  =config.loglevel
            
        this.inputchoice = config.inputchoice
        this.inputobject = config.inputobject
        this.inputobjectType = config.inputobjectType
        node.on('input', function(msg) {
            
            // 判断日志打印什么
            let logmessage = ConstructLogMessage(node, msg)
             //打印日志到调试窗口
            if (node.sendpane) { // User wants the logentry also in the debug pane of the webinterface
				node.warn(logmessage.msg)
			}

            let currentDate = new Date();
            // 获取年、月、日
            let year = currentDate.getFullYear();
            let month = String(currentDate.getMonth() + 1).padStart(2, '0'); // 注意月份从0开始，需要加1，并补零
            let day = String(currentDate.getDate()).padStart(2, '0');
            
            // 获取时、分、秒、毫秒
            let hours = String(currentDate.getHours()).padStart(2, '0');
            let minutes = String(currentDate.getMinutes()).padStart(2, '0');
            let seconds = String(currentDate.getSeconds()).padStart(2, '0');
            let milliseconds = String(currentDate.getMilliseconds()).padStart(3, '0');
            
            // 格式化成标准日期时间字符串
            let formattedDateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
            // 日期目录名称
            let dayDirName = "/"+ year + "-" + month + "-" + day
            // 文件名称
            let fileName = "/" + year + "-" + month + "-" + day + "_" + node.loglevel + ".log"
            // 文件绝对路径 = 文件目录地址 + 日期目录名称 + 文件名称
            let completeLogPath = globalfilePath + dayDirName + fileName
            globalfileAddDayDir = globalfilePath + dayDirName
            node.send(msg)
            // 写入文件
            let msgJson = {
                "time": formattedDateTime,
                "nodeName": this.name,
                "level":node.loglevel,
                "msg": logmessage.msg
            }
            let msgJsonFinal = JSON.stringify(msgJson) + "\n"
            appendToFileWithCreate(completeLogPath, msgJsonFinal);

            //日志分片
            LogRotate(node, fileName, msgJsonFinal.length)
        });
    }
    function LogServerConfig(n) {
        RED.nodes.createNode(this,n);
        var node = this;
        globalfilePath = n.filePath
        logrotate_global = n.logrotate
		logcompress_global = n.logcompress
		logrotatecount_global = n.logrotatecount
		logsize_global = n.logsize
        // 判断是否需要日志清理
        if(n.deleteTime){
            //需要
            let array = n.deleteTime.split(":")
            let crontab = array[1] + " " + array[0] + " " + "*" + " " + "*" + " " + "*"
            node.repeaterSetup = function () {
            this.cronjob = scheduleTask(crontab,() => { 

                var currentDate = new Date();

                // 获取n.deleteDay天前的时间
                var daysAgo = new Date();
                daysAgo.setDate(currentDate.getDate() - n.deleteDay);

                let year = daysAgo.getFullYear();
                let month = String(daysAgo.getMonth() + 1).padStart(2, '0'); // 注意月份从0开始，需要加1，并补零
                let day = String(daysAgo.getDate()).padStart(2, '0');

                let dayDir = "/" + year + "-" + month + "-" + day 
                // 文件绝对路径 = 文件目录地址 + 文件名称
                let completeLogPath = globalfilePath + dayDir
                //删除30天前的日志
                deleteDirectory(completeLogPath);
                
            });
            };
            node.repeaterSetup();
        }else{
            //不需要
        }
    }
    // 打印日志到控制台所需方法
	function VarToString(v) {
		if (typeof v == 'object') {
			vs = JSON.stringify(v)
		} else {
			vs = v
		}
		return vs
	}
    //打印日志到控制台所需方法
    function ConstructLogMessage(node, msg) {
        if (node.inputchoice == "object" && node.inputobject.length>0 ) {
			message = "Please choose a flow or global name!"
			if ( node.inputobjectType == "msg") {
				if (node.inputobject) {
					messageRaw = eval("msg." + node.inputobject)
                    message = {
                        [node.inputobject]:messageRaw
                    }
					messageVar = "msg." + node.inputobject
				} else {
                    messageRaw = msg
                    message = messageRaw
                    messageVar = "msg"
				}
			} else if (node.inputobjectType == "flow" ) {
                let prefix = "flow.";
				flowvar = node.inputobject
				messageRaw = node.context().flow.get(flowvar)
				message = {
                    [prefix+node.inputobject]:messageRaw
                }
				messageVar = "flow." + flowvar
			} else if (node.inputobjectType == "global") {
                let prefix = "global.";
				globalvar = node.inputobject
				messageRaw = node.context().global.get(globalvar)
                message = {
                    [prefix+node.inputobject]:messageRaw
                }
				messageVar = "global." + globalvar
			}
		}else{
            messageRaw = msg
            message = messageRaw
            messageVar = "msg"
        }

		return {msg: message, var: messageVar, raw: messageRaw}
	}
    //写入文件
    function appendToFileWithCreate(pathToFile, data, callback) {
        // 获取文件所在目录的路径
        const directory = path.dirname(pathToFile);
        
        // 递归创建目录
        fs.mkdir(directory, { recursive: true }, (mkdirErr) => {
            if (mkdirErr) {
            return;
            }
            // 追加写入文件
            fs.writeFile(pathToFile, data, { flag: 'a' }, (writeErr) => {

            });
        });
    }
    //删除目录
    function deleteDirectory(directoryPath) {
        // 递归删除目录
        if (fs.existsSync(directoryPath)) {
          fs.readdirSync(directoryPath).forEach((file) => {
            const currentPath = path.join(directoryPath, file);
      
            if (fs.lstatSync(currentPath).isDirectory()) {
              // 递归删除子目录
              deleteDirectory(currentPath);
            } else {
              // 删除文件
              fs.unlinkSync(currentPath);
            }
          });
      
          // 删除空目录
          fs.rmdirSync(directoryPath);
        } else {
          console.error('Directory not found:', directoryPath);
        }
    }
    //日志分片
    function LogRotate(node, filename, addlength) {
		if (logrotate_global && filename) {
			fullpath = globalfileAddDayDir + filename
			if (fs.existsSync(fullpath)) {
				stats = fs.statSync(fullpath)
				fileSizeInBytes = stats["size"]
				if (fileSizeInBytes + addlength + 1 >= logsize_global * 1000 ) {
					rotate(fullpath, { count: logrotatecount_global, compress: (logcompress_global==true)}, function(err) {
						if (err) {
							node.warn("Could not rotate logfiles: " + err)
						} else {
							if (!fs.existsSync(fullpath)) {
								fs.appendFileSync(fullpath,'');  // Create a new empty file if there is none
							}
						}
					})
				}
			}
		}
	}
    //注册到Node的方法
    RED.nodes.registerType("log-server-config",LogServerConfig);
    RED.nodes.registerType("log-to-file",LogToFile);
    //部署时调用 删除定时任务
    LogServerConfig.prototype.close = function() {
        if (this.cronjob != null) {
            this.cronjob.stop();
            delete this.cronjob;
        }
    };

}