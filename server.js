function DoWork() {
    if (BotData.Id == '') {
        T.get('account/verify_credentials', { skip_status: true },  function(err, data, response) {
            BotData.Id = data.id_str;
            BotData.Handle = new String('@' + data.screen_name);
            DoWork();
        });
    }
    else {
        var t_timeline_data = { user_id: BotData.Id };
        if (BotData.Since != '') {
            t_timeline_data.since_id = BotData.Since;
        }
        
        T.get('statuses/user_timeline', t_timeline_data,  function(err, data, response) {
            if (typeof data != 'undefined') {
                for (var i=0; i < data.length; i++) {
                    var d = data[i];
                    if (BotData.Since == '' || d.id > BotData.Since) {
                        BotData.Since = d.id_str;
                    }
                    if (d.retweeted == true) {
                        cacheStatusForRSS(d);
                    }
                }
                
                console.log('Checking Mentions Since: ' + BotData.Since);
                var mt_timeline_data = { };
                if (BotData.Since != '') {
                    mt_timeline_data.since_id = BotData.Since;
                }
                T.get('statuses/mentions_timeline', mt_timeline_data, function(err, data, response) {
                    if (typeof data != 'undefined') {
                        for (var i=0; i < data.length; i++) {
                            var d = data[i];
                            if (d.user.following == true) {
                                var mtxt = new String(d.text);
                                while(mtxt.indexOf(BotData.Handle) >= 0) {
                                    mtxt = mtxt.replace(BotData.Handle, '');
                                }
                                if (mtxt.toLowerCase().indexOf('coffee') >= 0) {
                                    T.post('statuses/retweet/:id', { id: d.id_str }, function (err, data, response) {
                                        if (typeof data != 'undefined') {
                                            if (data.id > BotData.Since) {
                                                console.log('Retweeted: ' + data.id_str);
                                                BotData.Since = data.id_str;
                                                cacheStatusForRSS(data);
                                            }
                                        }
                                    });
                                }
                            }
                        }
                    }
                });
            }
        });
    }
}

function cacheStatusForRSS(data) {
    if (typeof data.retweeted_status.user.screen_name == 'undefined') {
        RSSData.push({
            id_str          : data.id_str,
            by_screen_name  : data.user.screen_name,
            created_at      : data.created_at,
            text            : data.text
        });
      } else {
        RSSData.push({
            id_str          : data.retweeted_status.id_str,
            by_screen_name  : data.retweeted_status.user.screen_name,
            created_at      : data.retweeted_status.created_at,
            text            : data.retweeted_status.text
        });
    }
}

function sortRssFeed(a,b) {
  if (a.id_str < b.id_str)
     return 1;
  if (a.id_str > b.id_str)
    return -1;
  return 0;
}

var Twit = require('twit');
var TwitConfig = {
    consumer_key        : process.env.CONSKEY,
    consumer_secret     : process.env.CONSSKRT,
    access_token        : process.env.ACCTOK,
    access_token_secret : process.env.ACCTOKSKRT
};
var T = new Twit(TwitConfig);

var BotData = {
    Id: '',
    Handle: '',
    Since: ''
};

var RSSData = [];

DoWork();
setInterval(DoWork, 60000);



var http = require('http');
http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    var sOut = '';
    
    RSSData.sort(sortRssFeed);
    
    for (var i=0; i < RSSData.length; i++) {
        var r = RSSData[i];
        sOut += ' <item>\n'
        sOut += ' <title>@' + r.by_screen_name + ' on ' + r.created_at + '</title>\n';
        sOut += ' <link>https://twitter.com/' + r.by_screen_name + '/status/' + r.id_str + '</link>\n';
        sOut += ' <description>' + r.text + '</description>\n';
        sOut += ' <guid>https://twitter.com/' + r.by_screen_name + '/status/' + r.id_str + '</guid>\n';
        sOut += ' </item>\n';
    }
    
    if (sOut == '') {
        sOut = 'Hello World\n';
      } else {
        var sHead = '<?xml version="1.0" encoding="utf-8"?>\n <rss version="2.0">\n <channel>\n';
        sHead += ' <title>Twitter RSS Feed for ' + BotData.Handle + '</title>\n <link>https://twitter.com/' + BotData.Handle.replace('@', '') + '</link>\n <description>Coffee tweets from select awesome people.</description>';
 
        sOut = sHead + sOut + ' </channel>\n </rss>\n';
    }
    res.end(sOut);
}).listen(process.env.PORT || 1337);
console.log('Server running on port: ' + process.env.PORT);
