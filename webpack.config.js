const path = require("path");
const glob = require("glob");

module.exports = {
    mode: "production",
    entry: [...glob.sync('./framework/**/*.*js', {follow: true}).map(f=>"./"+f.toString()), 
		...glob.sync('./apps/**/*.*js', {follow: true}).map(f=>"./"+f.toString())],
    output: {
        filename: "neuranet.js",
        path: path.resolve(__dirname, "neuranet.webpack"),
    },
};