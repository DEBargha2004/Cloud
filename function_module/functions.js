module.exports = formatOf = (path) => {
    var arr = path.split('/');
    var last = arr[arr.length-1]
    return last
}